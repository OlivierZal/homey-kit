// The webviews' shared dirty-gating primitive: one gate owns one Apply
// button — greyed while the form is not worth submitting OR a request
// is in flight — its sibling Refresh buttons, greyed by busy alone so
// they stay the escape hatch on a pristine form, and the form's
// fieldsets, frozen by busy alone: every success path rewrites the
// fields, so an edit slipped in mid-flight would be silently clobbered
// when the response lands — the freeze closes that window. The factory
// owns the whole invariant; a call site only supplies its arming source
// (a pure snapshot or a domain predicate, exclusively).
// Single-sourced here for every consuming Homey app.

/**
 * The live handle a call site drives its gated form region with.
 * @category Webview
 */
export interface DirtyGate {
  /**
   * Re-snapshots the baseline after a (re)populate or successful save,
   * dropping Apply back to greyed; in predicate mode there is no
   * baseline to move, so it only re-evaluates.
   */
  readonly markSaved: () => void
  /**
   * Re-evaluates arming after a programmatic field write, which fires
   * no `input` event for {@link DirtyGate.wire} to catch.
   */
  readonly recompute: () => void
  /**
   * Routes a request through the busy window: freezes the region, runs
   * the action, and releases only if no newer action claimed the gate
   * since.
   */
  readonly runBusy: (action: () => Promise<void>) => Promise<void>
  /**
   * Manually flips the busy freeze, for call sites whose lifecycle
   * cannot be expressed as one {@link DirtyGate.runBusy} action.
   */
  readonly setBusy: (isBusy: boolean) => void
  /**
   * Subscribes arming re-evaluation to `change` and `input` on the
   * controls the arming source reads.
   */
  readonly wire: (targets: readonly EventTarget[]) => void
}

/**
 * Gate wiring: the owned buttons and frozen regions, plus exactly ONE
 * arming source — a pure snapshot (baseline mode) or a domain predicate
 * (predicate mode). The pair is exclusive by type: a predicate site has
 * no use for a baseline, which the predicate would short-circuit into
 * dead weight that retains stale form state.
 * @category Webview
 */
export type DirtyGateOptions = {
  /**
   * The Apply button this gate owns and greys.
   */
  readonly applyElement: HTMLButtonElement
  /**
   * Regions frozen while a request is in flight. Every region the
   * arming source reads must be listed: each success path rewrites the
   * fields, so an edit slipped in mid-flight would otherwise be
   * silently clobbered when the response lands.
   */
  readonly fieldsetElements?: readonly HTMLFieldSetElement[]
  /**
   * Sibling Refresh buttons, greyed by busy alone — never by pristine,
   * so they stay the escape hatch on an untouched form.
   */
  readonly refreshElements?: readonly HTMLButtonElement[]
} & (
  | {
      readonly isActionable?: undefined
      /**
       * Baseline mode: a PURE snapshot of the form's current values —
       * never a request-body builder, whose filtered defaults and null
       * deltas would desync the pristine check. Apply arms when the
       * snapshot diverges from the saved baseline.
       */
      readonly serialize: () => string
    }
  | {
      readonly serialize?: undefined
      /**
       * Predicate mode: arms Apply only when pressing it would send
       * something — for wire protocols that cannot express every form
       * divergence (an emptied field means "no instruction" and is
       * omitted from the request).
       */
      readonly isActionable: () => boolean
    }
)

// Predicate mode consults the domain judgment; baseline mode diffs the
// pure snapshot against the saved baseline.
const isArmed = (
  options: DirtyGateOptions,
  saved: string | undefined,
): boolean =>
  options.isActionable === undefined
    ? options.serialize() !== saved
    : options.isActionable()

// `input` covers live typing in number/date fields; `change` covers the
// selects and the final commit (and, since the arming source reads the
// whole form, any field a cascade handler mutated).
const wireRecompute = (
  targets: readonly EventTarget[],
  recompute: () => void,
): void => {
  for (const target of targets) {
    for (const eventName of ['change', 'input']) {
      target.addEventListener(eventName, recompute)
    }
  }
}

// Fieldsets freeze on busy — `disabled` on the CONTAINER, so a control's
// own `disabled` (a domain state, e.g. an unsupported capability)
// survives the release untouched — and `aria-busy` mirrors the freeze
// for assistive tech.
const setFrozen = (
  fieldsetElements: readonly HTMLFieldSetElement[],
  isFrozen: boolean,
): void => {
  for (const element of fieldsetElements) {
    element.disabled = isFrozen
    element.setAttribute('aria-busy', String(isFrozen))
  }
}

/**
 * Builds the gate over a form region. Arming is evaluated at creation:
 * baseline mode starts greyed even when no data ever loads (the form
 * matches its own snapshot); predicate mode starts wherever
 * `isActionable` puts it — a prefilled form may legitimately arm at
 * once. Buttons grey through native `disabled` (not a CSS class): it
 * blocks keyboard activation during in-flight actions and is announced
 * by screen readers.
 * @param options - Buttons, frozen regions and the single arming source.
 * @returns The live gate handle.
 * @category Webview
 */
export const createDirtyGate = (options: DirtyGateOptions): DirtyGate => {
  const { applyElement, fieldsetElements = [], refreshElements = [] } = options
  let busyGeneration = 0
  let isBusy = false
  let saved = options.serialize?.()
  const recompute = (): void => {
    applyElement.disabled = isBusy || !isArmed(options, saved)
  }
  const markSaved = (): void => {
    saved = options.serialize?.()
    recompute()
  }
  // Refresh is gated by busy ALONE (never dirty); Apply folds the busy
  // flag into its arming check so a mid-request edit cannot re-enable
  // it; the fieldsets freeze and thaw with it (`setFrozen`).
  const setBusy = (isBusyNow: boolean): void => {
    isBusy = isBusyNow
    for (const element of refreshElements) {
      element.disabled = isBusyNow
    }
    setFrozen(fieldsetElements, isBusyNow)
    recompute()
  }
  // Generation-tokened: only the action holding the latest claim may
  // release the busy state, so an overlapping action can never free the
  // buttons a live request still owns.
  const runBusy = async (action: () => Promise<void>): Promise<void> => {
    const generation = ++busyGeneration
    setBusy(true)
    try {
      await action()
    } finally {
      if (generation === busyGeneration) {
        setBusy(false)
      }
    }
  }
  recompute()
  return {
    markSaved,
    recompute,
    runBusy,
    setBusy,
    wire: (targets: readonly EventTarget[]): void => {
      wireRecompute(targets, recompute)
    },
  }
}
