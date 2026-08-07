// Self-heal for the phone webview cache. Pages and their bundles are
// cached across app versions — the HTML itself included (proven in the
// wild), so a booted page may run stale UI code indefinitely: the
// cached HTML's `?v=` stamps keep serving the matching cached assets.
// The page's identity is the DOCUMENT-ORDER join of every `?v=` stamp
// it carries (so a CSS-only or markup-only ship moves it too); the app
// serves the live identities (`GET /webview-hashes`, emitted at
// package time), fetched through the app bridge so no HTTP cache can
// stale them. On mismatch the page refetches itself ONCE, through an
// address the HTTP cache has never seen: a bare reload can be served
// the same stale document again (proven on-device by a page mixing
// asset generations), burning the one-shot guard on a no-op. A
// mismatch that survives its refetch is reported through the optional
// `report` channel instead of retried. Every failure path stays open
// (unstamped page, unreachable route, unknown entry, denied storage):
// a wrong guess must never take a working webview down.

import { fireAndForget } from '../fire-and-forget.ts'

const REFETCH_GUARD_KEY = 'webview_refetched_for'

const RECHECK_FAILED = 'Webview freshness re-check failed:'

const STAMP = /\?v=(?<hash>[0-9a-f]+)$/u

const fetchHashesSafely = async (
  fetchHashes: () => Promise<Partial<Record<string, string>>>,
): Promise<Partial<Record<string, string>>> => {
  try {
    return await fetchHashes()
  } catch {
    return {}
  }
}

const fetchExpected = async (
  entry: string,
  fetchHashes: () => Promise<Partial<Record<string, string>>>,
): Promise<string | undefined> => {
  const hashes = await fetchHashesSafely(fetchHashes)
  return hashes[entry]
}

/**
 * The booted page's own identity: the document-order join of every
 * `?v=` stamp it carries, or `null` on an unstamped page (a dev run,
 * where nothing is stamped). Displaying it is the one-glance answer to
 * "am I looking at a cached page?", which no version number can give —
 * phone webviews cache assets across app versions, so the app version
 * on screen says nothing about the bundle behind it.
 * @returns The joined stamps, or `null` when the page carries none.
 * @category Webview
 */
export const getPageIdentity = (): string | null => {
  // Joined in DOCUMENT order — the stamping side iterates the same
  // HTML in source order, so the two joins agree with no comparator
  // (and no locale hazard); the Set drops a hypothetical duplicate
  // reference the stamping side would also collapse.
  const stamps = [
    ...new Set(
      [...document.querySelectorAll('[href*="?v="], [src*="?v="]')].flatMap(
        (element) => {
          const reference =
            element.getAttribute('href') ?? element.getAttribute('src') ?? ''
          const hash = STAMP.exec(reference)?.groups?.hash
          return hash === undefined ? [] : [hash]
        },
      ),
    ),
  ]
  return stamps.length > 0 ? stamps.join('.') : null
}

// Denied storage cannot arm the loop guard, so it must not refetch:
// the address is deterministic per identity, and an unguarded attempt
// re-served from the cache would boot-navigate forever. Skipping (and
// saying so) is the safe side of that trade.
const DENIED = Symbol('denied')

const readStoredGuard = (): string | symbol | null => {
  try {
    return sessionStorage.getItem(REFETCH_GUARD_KEY)
  } catch {
    return DENIED
  }
}

const readRefetchGuard = (hash: string): 'armed' | 'denied' | 'spent' => {
  const stored = readStoredGuard()
  if (stored === DENIED) {
    return 'denied'
  }
  return stored === hash ? 'spent' : 'armed'
}

// Returns whether the guard was persisted — navigating without it risks
// the same livelock as a denied read, so a failed write also skips.
const markRefetchedFor = (hash: string): boolean => {
  try {
    sessionStorage.setItem(REFETCH_GUARD_KEY, hash)
    return true
  } catch {
    return false
  }
}

// The `fresh` key makes the address one the HTTP cache has never seen,
// forcing a network fetch of the document; it is overwritten, never
// accumulated, and carries the stale identity — not a clock or random
// read, which would mint a new address on every boot and sidestep the
// per-identity guard. A navigation failure is reported and swallowed:
// the stale page must keep booting.
const refetchDocument = (
  identity: string,
  report?: (message: string) => void,
): boolean => {
  try {
    const url = new URL(location.href)
    url.searchParams.set('fresh', identity)
    location.replace(url.href)
    return true
  } catch {
    report?.(`Stale webview refetch could not navigate: page ${identity}`)
    return false
  }
}

// Reports the guard outcome that stops a refetch, if any.
const reportStopped = ({
  expected,
  guard,
  identity,
  report,
}: {
  expected: string
  guard: 'armed' | 'denied' | 'spent'
  identity: string
  report?: ((message: string) => void) | undefined
}): boolean => {
  if (guard === 'denied') {
    report?.(
      `Stale webview: page ${identity}, live ${expected} — storage denied, refetch skipped`,
    )
    return true
  }
  if (guard === 'spent') {
    report?.(
      `Stale webview persists after its refetch: page ${identity}, live ${expected}`,
    )
    return true
  }
  return false
}

// One-shot refetch decision for a confirmed mismatch: refetches unless
// this identity already spent its attempt or the guard cannot hold one,
// reporting each outcome distinctly.
const refetchOnce = (
  identity: string,
  expected: string,
  report?: (message: string) => void,
): boolean => {
  const guard = readRefetchGuard(identity)
  if (reportStopped({ expected, guard, identity, report })) {
    return false
  }
  if (!markRefetchedFor(identity)) {
    report?.(
      `Stale webview: page ${identity}, live ${expected} — guard unwritable, refetch skipped`,
    )
    return false
  }
  report?.(`Stale webview: page ${identity}, live ${expected} — refetching`)
  return refetchDocument(identity, report)
}

/**
 * Compares the booted page's `?v=` identity against the app-served live
 * hashes and refetches the document ONCE through a never-cached address
 * on mismatch. Every failure path stays open (unstamped page,
 * unreachable route, unknown entry, denied storage): a wrong guess must
 * never take a working webview down.
 * @param entry - The page's key in the served hash manifest.
 * @param fetchHashes - Bridge call returning the live hashes; the transport is the caller's.
 * @param report - Optional diagnostics sink receiving each refetch decision.
 * @returns Whether a refetch was issued — the caller must then skip its own init: the document is about to be replaced.
 * @category Webview
 */
export const ensureFreshWebview = async (
  entry: string,
  fetchHashes: () => Promise<Partial<Record<string, string>>>,
  report?: (message: string) => void,
): Promise<boolean> => {
  const identity = getPageIdentity()
  if (identity === null) {
    return false
  }
  const expected = await fetchExpected(entry, fetchHashes)
  if (expected === undefined || expected === identity) {
    return false
  }
  return refetchOnce(identity, expected, report)
}

/**
 * Wiring for {@link watchWebviewFreshness}: the handshake's inputs plus
 * the app's own poke channel.
 * @category Webview
 */
export interface WatchWebviewFreshnessOptions {
  /**
  The page's key in the served hash manifest.
   */
  readonly entry: string
  /**
  Optional diagnostics sink receiving each refetch decision, deduplicated.
   */
  readonly report?: ((message: string) => void) | undefined
  /**
   * Optional subscription to the app's `webview_hashes_changed` poke:
   * receives the re-check to register.
   */
  readonly subscribe?: ((onPoke: () => void) => void) | undefined
  /**
  Bridge call returning the live hashes; the transport is the caller's.
   */
  readonly fetchHashes: () => Promise<Partial<Record<string, string>>>
}

// No check once a refetch is issued: the document is being replaced, so
// a trigger firing behind it would re-run the handshake for nothing.
// Consecutive identical breadcrumbs collapse — a page that stays stale
// would otherwise log the same line on every return to the foreground.
const createRunner = ({
  entry,
  fetchHashes,
  report,
}: WatchWebviewFreshnessOptions): {
  reportOnce: (message: string) => void
  run: () => Promise<boolean>
} => {
  let isSpent = false
  let previous: string | undefined
  const reportOnce = (message: string): void => {
    if (message === previous) {
      return
    }

    previous = message
    report?.(message)
  }
  const spend = (isRefetching: boolean): boolean => {
    if (isRefetching) {
      isSpent = true
    }
    return isRefetching
  }
  return {
    reportOnce,
    run: async (): Promise<boolean> =>
      isSpent
        ? false
        : spend(await ensureFreshWebview(entry, fetchHashes, reportOnce)),
  }
}

// The whole guarantee rests on the BOOT check: a new document checks
// itself, so every surface that remounts its page is fresh for free —
// the Homey web app tears the settings page down while the app
// restarts and mounts it again, which is why it never looks stale. A
// mobile webview instead SURVIVES the app restart: no new document, no
// boot check, and the page stays stale indefinitely. This trigger
// restores on a surviving page what the remount gives away elsewhere.
//
// It carries that guarantee ALONE. The app's `webview_hashes_changed`
// poke cannot: it is emitted at the end of the app's own `onInit`,
// i.e. at the instant the restart has just disconnected every open
// page, so its audience is absent by construction — measured
// on-device, an open page produced no hash call and no breadcrumb.
// Never fold this trigger into that one.
//
// Registration is fail-open: a page that cannot observe visibility
// keeps its boot check.
const onVisible = (recheck: () => void): void => {
  try {
    document.addEventListener('visibilitychange', () => {
      whenVisible(recheck)
    })
  } catch {
    // A degraded page is still a running page.
  }
}

const whenVisible = (recheck: () => void): void => {
  if (document.visibilityState === 'visible') {
    recheck()
  }
}

// Adapts the breadcrumb sink to the fire-and-forget logger seam, so a
// rejected re-check reaches the same channel as every other freshness
// decision instead of a console the phone never shows.
const toBreadcrumb =
  (reportOnce: (message: string) => void) =>
  (...args: readonly unknown[]): void => {
    reportOnce(args.map(String).join(' '))
  }

/**
 * Runs the freshness handshake at boot and re-runs it whenever the page
 * returns to the foreground — the trigger that covers a webview
 * surviving an app restart, where no new document (and so no boot
 * check) ever happens. The app's poke is subscribed too when a channel
 * is given, but it guarantees nothing on its own: it fires while open
 * pages are disconnected. A refetch stays bounded to one per identity
 * by the handshake's guard, and no trigger fires once one is issued.
 * @param options - The handshake's inputs plus the app's poke channel.
 * @returns Whether the boot check issued a refetch — the caller must then skip its own init: the document is about to be replaced.
 * @category Webview
 */
export const watchWebviewFreshness = async (
  options: WatchWebviewFreshnessOptions,
): Promise<boolean> => {
  const { reportOnce, run } = createRunner(options)
  // Detached through the one sanctioned seam: a re-check that throws
  // becomes a breadcrumb, never a rejection escaping into a live page.
  const recheck = (): void => {
    fireAndForget(run(), { error: toBreadcrumb(reportOnce) }, RECHECK_FAILED)
  }
  onVisible(recheck)
  options.subscribe?.(recheck)
  try {
    return await run()
  } catch {
    return false
  }
}
