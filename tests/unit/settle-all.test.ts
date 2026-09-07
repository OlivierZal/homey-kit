import { setImmediate as nextTick } from 'node:timers/promises'

import { describe, expect, it, vi } from 'vitest'

import { settleAll } from '../../src/settle-all.ts'

describe(settleAll, () => {
  it('should settle every branch and report each rejection on its own', async () => {
    const logger = { error: vi.fn<(...args: readonly unknown[]) => void>() }
    const first = new Error('first down')
    const second = new Error('second down')
    const survivor = Promise.withResolvers<boolean>()
    const onSettled = vi.fn<() => void>()
    const settle = async (): Promise<void> => {
      await settleAll(
        [Promise.reject(first), survivor.promise, Promise.reject(second)],
        logger,
        'Work failed:',
      )
      onSettled()
    }

    const settled = settle()
    await nextTick()

    // Both rejections are already seen; the call must still hold for the
    // pending branch — returning once every rejection is reported would
    // be a partial settle the apps never had.
    expect(onSettled).not.toHaveBeenCalled()

    survivor.resolve(true)
    await settled

    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenNthCalledWith(1, 'Work failed:', first)
    expect(logger.error).toHaveBeenNthCalledWith(2, 'Work failed:', second)
  })

  it('should stay silent when every branch settles', async () => {
    const logger = { error: vi.fn<(...args: readonly unknown[]) => void>() }

    await settleAll([Promise.resolve(1), Promise.resolve(2)], logger, 'never')

    expect(logger.error).not.toHaveBeenCalled()
  })
})
