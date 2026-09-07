// @vitest-environment happy-dom
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest'

import { getMockCallArg, settleDetached } from '../../src/testing/helpers.ts'
import {
  type WidgetFreshnessHost,
  watchWidgetFreshness,
} from '../../src/widget/watch-widget-freshness.ts'

// The orchestrator under test owns the WIRING: the entry key, the two
// routes and the poke channel over the promise-native transport. The
// handshake's own behavior (guards, fences, triggers) is pinned in
// `webview-freshness.test.ts`.

const ENTRY = 'ata-group-setting'

// A stamped reference the identity join reads; a preload hint rather
// than a `<script src>`, which the DOM environment would try to load.
const stampPage = (hash: string): void => {
  const reference = document.createElement('link')
  reference.rel = 'modulepreload'
  reference.href = `index.js?v=${hash}`
  document.head.append(reference)
}

const hashRoutes = (hash: string): Partial<Record<string, unknown>> => ({
  'GET /webview-hashes': { [ENTRY]: hash },
})

interface Harness {
  api: Mock<WidgetFreshnessHost['api']>
  homey: WidgetFreshnessHost
  emit: (event: string) => void
}

const install = ({
  failures = {},
  routes = {},
}: {
  failures?: Partial<Record<string, Error>>
  routes?: Partial<Record<string, unknown>>
} = {}): Harness => {
  const listeners = new Map<string, () => void>()
  const api = vi.fn<WidgetFreshnessHost['api']>(async (method, path) => {
    const failure = failures[`${method} ${path}`]
    return failure === undefined
      ? Promise.resolve(routes[`${method} ${path}`])
      : Promise.reject(failure)
  })
  return {
    api,
    homey: {
      api,
      on: (event, listener): void => {
        listeners.set(event, listener)
      },
    },
    emit: (event: string): void => {
      listeners.get(event)?.()
    },
  }
}

describe(watchWidgetFreshness, () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.head.replaceChildren()
  })

  it('should keep an unstamped page booting without any fetch', async () => {
    const { api, homey } = install({ routes: hashRoutes('aaaaaaaa') })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)

    expect(api).not.toHaveBeenCalledWith('GET', '/webview-hashes')
  })

  it('should compare under the given entry key and keep a matching page booting', async () => {
    stampPage('aaaaaaaa')
    // The live map only answers for the entry: a wrong key would read
    // `undefined` and stay put regardless, so the stale case below pins
    // the key together with this one.
    const { api, homey } = install({ routes: hashRoutes('aaaaaaaa') })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)

    expect(api).toHaveBeenCalledWith('GET', '/webview-hashes')
  })

  it('should report a mismatch that survived its refetch over the boot-error route', async () => {
    stampPage('aaaaaaaa')
    // The guard already carries this identity: the one refetch was spent.
    sessionStorage.setItem('webview_refetched_for', 'aaaaaaaa')
    const { api, homey } = install({ routes: hashRoutes('bbbbbbbb') })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)

    await settleDetached()

    // The boot check's GET is call 0; the breadcrumb POST follows it.
    expect(api).toHaveBeenCalledWith(
      'POST',
      '/boot-error',
      expect.objectContaining({ name: 'WebviewFreshness' }),
    )

    const breadcrumb = getMockCallArg<{ message: string }>(api, 1, 2)

    expect(breadcrumb.message).toContain('Stale webview persists')
  })

  it('should swallow a failing breadcrumb post', async () => {
    stampPage('aaaaaaaa')
    sessionStorage.setItem('webview_refetched_for', 'aaaaaaaa')
    const { homey } = install({
      failures: { 'POST /boot-error': new Error('channel down') },
      routes: hashRoutes('bbbbbbbb'),
    })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)

    await settleDetached()
  })

  it('should swallow a failing hash fetch and stay put', async () => {
    stampPage('aaaaaaaa')
    const { emit, homey } = install({
      failures: { 'GET /webview-hashes': new Error('bridge down') },
    })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)

    // The poke's recheck fails the same way and must not throw either.
    expect(() => {
      emit('webview_hashes_changed')
    }).not.toThrow()

    await settleDetached()
  })

  it('should re-run the handshake on the app poke', async () => {
    stampPage('aaaaaaaa')
    const { api, emit, homey } = install({ routes: hashRoutes('aaaaaaaa') })
    await watchWidgetFreshness(homey, ENTRY)
    const hashCalls = (): number =>
      api.mock.calls.filter(([, path]) => path === '/webview-hashes').length
    const before = hashCalls()

    emit('webview_hashes_changed')
    await settleDetached()

    expect(hashCalls()).toBe(before + 1)
  })
})
