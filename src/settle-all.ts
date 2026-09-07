import type { Logger } from './fire-and-forget.ts'

/**
 * Runs independent work to completion and reports every failure on its
 * own — the aggregate behind a device sync or a listener teardown.
 *
 * `Promise.all` is the wrong aggregate on both counts: it abandons the
 * aggregate at the first rejection — leaving the other branches
 * unsettled, and on a restart path skipping the very reconciliation
 * meant to repair that failure — and it surfaces one reason while
 * hiding the others, so a second failing branch leaves no trace.
 * Reserve `Promise.all` for aggregates whose caller genuinely cannot
 * continue without every branch.
 * @param promises - Already-started work, settled together.
 * @param logger - Rejection sink; an app or device instance passes itself.
 * @param message - Context line logged ahead of each rejection reason.
 * @category Utilities
 */
export const settleAll = async (
  promises: Iterable<Promise<unknown>>,
  logger: Logger,
  message: string,
): Promise<void> => {
  const results = await Promise.allSettled(promises)
  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error(message, result.reason)
    }
  }
}
