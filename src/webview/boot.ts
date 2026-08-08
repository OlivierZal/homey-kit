/**
 * The boot cycle every webview shares. Its one invariant: the loading
 * overlay always ends. `Homey.ready()` runs whatever happens — a hung
 * transport call, a rejecting init chain, a page that throws while
 * building itself — because a page that never calls it spins forever
 * with no way for the user to recover.
 * @packageDocumentation
 */

// Give slow transports a real chance while keeping the loading overlay
// finite: past this point the page surfaces the failure instead.
const INIT_TIMEOUT_MS = 10_000

const TIMEOUT_MESSAGE = 'Timed out while loading data from the app'

const UNHANDLED_MESSAGE = 'Unhandled webview error'

/**
 * Bounds an init chain against a hung transport call, so the caller's
 * `finally` can always reach `Homey.ready()`. The work is NOT cancelled:
 * a late success repaints over the degraded state rather than being
 * dropped.
 * @template T - Result type of the bounded work.
 * @param work - The init chain to bound.
 * @param message - Rejection message once the deadline passes.
 * @returns The work's result, or a rejection once the deadline passes.
 * @category Webview
 */
export const withInitTimeout = async <T>(
  work: Promise<T>,
  message: string = TIMEOUT_MESSAGE,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message))
        }, INIT_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Surfaces an error in the webview dev tools without blocking the
 * caller: `reportError` where the webview provides it, an async rethrow
 * otherwise. Never throws at the call site — surfacing a failure must
 * not create a second one.
 * @param error - The error to surface.
 * @param message - Wrapper message when the value thrown is not an Error.
 * @category Webview
 */
export const surfaceError = (
  error: unknown,
  message: string = UNHANDLED_MESSAGE,
): void => {
  if (typeof reportError === 'function') {
    reportError(error)
    return
  }
  setTimeout(() => {
    throw error instanceof Error ? error : new Error(message, { cause: error })
  }, 0)
}

/**
 * Runs an async operation that must not block the caller. Rejections go
 * to `onError`, which defaults to the dev-tools surface.
 *
 * Distinct from the root export of the same name: that one takes a
 * logger and a context message, because an app has a logger. A webview
 * has none — it surfaces.
 * @param promise - The already-started work.
 * @param onError - Rejection sink; defaults to {@link surfaceError}.
 * @category Webview
 */
export const fireAndForget = (
  promise: Promise<unknown>,
  onError: (error: unknown) => void = surfaceError,
): void => {
  // eslint-disable-next-line unicorn/prefer-await -- fire-and-forget: rejections route to onError without blocking the caller
  promise.catch(onError)
}

/**
 * The SDK member the boot cycle drives: the call that ends the loading
 * overlay. Described structurally so the package names no SDK types
 * package — both the settings and the widget instance satisfy it.
 * @category Webview
 */
export interface ReadyHost {
  /**
   * Ends the loading overlay, optionally sizing a widget.
   */
  ready: (options?: { height: number }) => void
}

/**
 * Options for {@link runWebview}.
 * @category Webview
 */
export interface RunWebviewOptions {
  /**
   * Rejection message once the deadline passes.
   */
  readonly timeoutMessage?: string
  /**
   * Widget height supplier, forwarded to `ready`. Omit on a settings
   * page, which sizes itself.
   */
  readonly height?: () => number
  /**
   * Surfaces an init failure BEFORE `ready`, for a page that must paint
   * its error state at the right size. A caller that would rather
   * report after the overlay closes reads the returned outcome instead.
   */
  readonly onError?: (error: unknown) => void
}

/**
 * Runs a webview's init chain with the guarantees every page shares:
 * the work is time-bounded, a failure reaches `onError`, and
 * `Homey.ready()` always fires — a hung or failed init can never hold
 * the loading overlay open.
 * @param homey - Anything exposing the SDK's `ready`.
 * @param work - The page's init work, already started.
 * @param options - Failure surface, widget height, timeout message.
 * @returns The caught error and whether init failed, readable after
 * `ready` by a caller that reports once the overlay has closed.
 * @category Webview
 */
export const runWebview = async (
  homey: ReadyHost,
  work: Promise<void>,
  options: RunWebviewOptions = {},
): Promise<{ error: unknown; hasFailed: boolean }> => {
  const { height, onError, timeoutMessage } = options
  let error: unknown
  let hasFailed = false
  try {
    await withInitTimeout(work, timeoutMessage)
  } catch (error_) {
    error = error_
    hasFailed = true
    onError?.(error_)
  } finally {
    homey.ready(height === undefined ? undefined : { height: height() })
  }
  return { error, hasFailed }
}

/**
 * Applies the app's display language to the document, never aborting an
 * init over it: the language is cosmetic, so a failed read leaves the
 * page on its authored default.
 * @param fetchLanguage - Reads the language tag from the app.
 * @param onError - Failure sink; omit to fail silently.
 * @category Webview
 */
export const trySetDocumentLanguage = async (
  fetchLanguage: () => Promise<string>,
  onError?: (error: unknown) => void,
): Promise<void> => {
  try {
    document.documentElement.lang = await fetchLanguage()
  } catch (error) {
    onError?.(error)
  }
}
