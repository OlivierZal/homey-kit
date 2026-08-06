import { describe, expect, it, vi } from 'vitest'

import { fireAndForget } from '../../src/fire-and-forget.ts'

describe('fire and forget', () => {
  it('should log a rejection instead of propagating it', async () => {
    expect.assertions(1)

    const error = vi.fn<(...args: readonly unknown[]) => void>()
    const failure = new Error('boom')

    fireAndForget(Promise.reject(failure), { error }, 'Detached work failed:')
    // The catch handler settles on a microtask; one macrotask flush is
    // deterministic where a polling wait would not be.
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    expect(error).toHaveBeenCalledWith('Detached work failed:', failure)
  })

  it('should stay silent on resolution', async () => {
    const error = vi.fn<(...args: readonly unknown[]) => void>()

    fireAndForget(Promise.resolve('done'), { error }, 'unused')
    await Promise.resolve()

    expect(error).not.toHaveBeenCalled()
  })
})
