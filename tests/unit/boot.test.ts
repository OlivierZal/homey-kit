// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type ReadyHost,
  fireAndForget,
  runWebview,
  surfaceError,
  trySetDocumentLanguage,
  withInitTimeout,
} from '../../src/webview/boot.ts'

const INIT_TIMEOUT_MS = 10_000

// Stands in for a transport that never answers — the case the deadline
// exists for.
const { promise: neverSettles } = Promise.withResolvers<never>()

const flush = async (): Promise<void> => {
  await Promise.resolve()
}

// `reportError` is a webview global the test environment does not
// provide; each case decides whether it exists.
const withReportError = (
  reporter: ((error: unknown) => void) | undefined,
): void => {
  if (reporter === undefined) {
    Reflect.deleteProperty(globalThis, 'reportError')
    return
  }
  Object.defineProperty(globalThis, 'reportError', {
    configurable: true,
    value: reporter,
    writable: true,
  })
}

const mockReady = (): ReadyHost['ready'] => vi.fn<ReadyHost['ready']>()

describe(withInitTimeout, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves with the work when it finishes first', async () => {
    await expect(withInitTimeout(Promise.resolve('done'))).resolves.toBe('done')
  })

  it('rejects once the deadline passes', async () => {
    const pending = withInitTimeout(neverSettles)
    const advancing = vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS)

    await expect(pending).rejects.toThrow(
      'Timed out while loading data from the app',
    )

    await advancing
  })

  it('rejects with the caller message when given one', async () => {
    const pending = withInitTimeout(
      neverSettles,
      'Timed out while loading the settings page',
    )
    const advancing = vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS)

    await expect(pending).rejects.toThrow(
      'Timed out while loading the settings page',
    )

    await advancing
  })

  it('propagates the work rejection rather than the deadline', async () => {
    await expect(
      withInitTimeout(Promise.reject(new Error('transport down'))),
    ).rejects.toThrow('transport down')
  })

  it('clears the timer once the work settles', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')

    await withInitTimeout(Promise.resolve('done'))

    expect(clearSpy).toHaveBeenCalledTimes(1)
  })
})

describe(surfaceError, () => {
  afterEach(() => {
    withReportError(undefined)
    vi.useRealTimers()
  })

  it('reports through the webview reporter when it exists', () => {
    const reporter = vi.fn<(error: unknown) => void>()
    const error = new Error('boom')
    withReportError(reporter)

    surfaceError(error)

    expect(reporter).toHaveBeenCalledWith(error)
  })

  it('rethrows asynchronously when the reporter is absent', () => {
    vi.useFakeTimers()
    const error = new Error('boom')
    withReportError(undefined)

    surfaceError(error)

    expect(() => {
      vi.advanceTimersByTime(0)
    }).toThrow(error)
  })

  it('wraps a non-Error rejection, with the caller message', () => {
    vi.useFakeTimers()
    withReportError(undefined)

    surfaceError('a string', 'Unhandled settings error')

    expect(() => {
      vi.advanceTimersByTime(0)
    }).toThrow('Unhandled settings error')
  })
})

describe(fireAndForget, () => {
  afterEach(() => {
    withReportError(undefined)
  })

  it('routes a rejection to the caller sink', async () => {
    const onError = vi.fn<(error: unknown) => void>()
    const error = new Error('detached')

    fireAndForget(Promise.reject(error), onError)
    await flush()

    expect(onError).toHaveBeenCalledWith(error)
  })

  it('surfaces a rejection when no sink is given', async () => {
    const reporter = vi.fn<(error: unknown) => void>()
    const error = new Error('detached')
    withReportError(reporter)

    fireAndForget(Promise.reject(error))
    await flush()

    expect(reporter).toHaveBeenCalledWith(error)
  })

  it('leaves a resolving promise alone', async () => {
    const onError = vi.fn<(error: unknown) => void>()

    fireAndForget(Promise.resolve('fine'), onError)
    await flush()

    expect(onError).not.toHaveBeenCalled()
  })
})

describe(runWebview, () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ends the overlay and reports no failure on success', async () => {
    const ready = mockReady()

    const outcome = await runWebview({ ready }, Promise.resolve())

    expect(outcome).toStrictEqual({ error: undefined, hasFailed: false })
    expect(ready).toHaveBeenCalledWith(undefined)
  })

  it('ends the overlay even when the init chain rejects', async () => {
    const ready = mockReady()
    const onError = vi.fn<(error: unknown) => void>()
    const error = new Error('init failed')

    const outcome = await runWebview({ ready }, Promise.reject(error), {
      onError,
    })

    expect(outcome).toStrictEqual({ error, hasFailed: true })
    expect(onError).toHaveBeenCalledWith(error)
    expect(ready).toHaveBeenCalledTimes(1)
  })

  it('surfaces the failure before ending the overlay', async () => {
    const calls: string[] = []
    const ready = vi.fn<ReadyHost['ready']>(() => {
      calls.push('ready')
    })

    await runWebview({ ready }, Promise.reject(new Error('init failed')), {
      onError: () => {
        calls.push('onError')
      },
    })

    expect(calls).toStrictEqual(['onError', 'ready'])
  })

  it('ends the overlay when the init chain hangs past the deadline', async () => {
    vi.useFakeTimers()
    const ready = mockReady()

    const pending = runWebview({ ready }, neverSettles)
    await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS)
    const outcome = await pending

    expect(outcome.hasFailed).toBe(true)
    expect(ready).toHaveBeenCalledTimes(1)
  })

  it('forwards the widget height to ready', async () => {
    const ready = mockReady()

    await runWebview({ ready }, Promise.resolve(), { height: () => 320 })

    expect(ready).toHaveBeenCalledWith({ height: 320 })
  })

  it('ends the overlay without a sink', async () => {
    const ready = mockReady()

    const outcome = await runWebview({ ready }, Promise.reject(new Error('x')))

    expect(outcome.hasFailed).toBe(true)
    expect(ready).toHaveBeenCalledTimes(1)
  })
})

describe(trySetDocumentLanguage, () => {
  beforeEach(() => {
    document.documentElement.lang = 'en'
  })

  it('applies the language the app reports', async () => {
    await trySetDocumentLanguage(
      vi.fn<() => Promise<string>>().mockResolvedValue('fr'),
    )

    expect(document.documentElement.lang).toBe('fr')
  })

  it('keeps the authored default when the read fails', async () => {
    await trySetDocumentLanguage(
      vi.fn<() => Promise<string>>().mockRejectedValue(new Error('offline')),
    )

    expect(document.documentElement.lang).toBe('en')
  })

  it('hands the failure to the caller sink', async () => {
    const onError = vi.fn<(error: unknown) => void>()
    const error = new Error('offline')

    await trySetDocumentLanguage(
      vi.fn<() => Promise<string>>().mockRejectedValue(error),
      onError,
    )

    expect(onError).toHaveBeenCalledWith(error)
  })
})
