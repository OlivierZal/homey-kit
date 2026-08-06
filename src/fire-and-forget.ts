/**
 * Structural logger seam: an app, device or driver instance passes
 * itself — anything with an `error` method fits, so no per-site error
 * adapter is ever needed.
 * @category Utilities
 */
export interface Logger {
  /**
   * Receives the fire-and-forget context message followed by the
   * rejection reason.
   */
  readonly error: (...args: readonly unknown[]) => void
}

/**
 * The one sanctioned fire-and-forget seam: detaches already-started
 * work from the caller's critical path, logging a rejection instead of
 * propagating it.
 * @param promise - Already-started work whose outcome must not block the caller.
 * @param logger - Rejection sink; an app or device instance passes itself.
 * @param message - Context line logged ahead of the rejection reason.
 * @category Utilities
 */
export const fireAndForget = (
  promise: Promise<unknown>,
  logger: Logger,
  message: string,
): void => {
  // eslint-disable-next-line unicorn/prefer-await -- the single fire-and-forget seam: rejections are logged, never propagated
  promise.catch((error: unknown) => {
    logger.error(message, error)
  })
}
