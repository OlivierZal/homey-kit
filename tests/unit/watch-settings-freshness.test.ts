import type Homey from 'homey/lib/HomeySettings.js'
import { type Mock, afterEach, describe, expect, it, vi } from 'vitest'

import { watchSettingsFreshness } from '../../src/settings/watch-settings-freshness.ts'
import {
  assertDefined,
  getMockCallArg,
  mock,
} from '../../src/testing/helpers.ts'

// The orchestrator under test owns the WIRING: the entry key, the two
// routes and the poke channel. The handshake's own behavior (guards,
// fences, triggers) is pinned in `webview-freshness.test.ts`.

class FakeReference {
  readonly #reference: string

  readonly #slot: string

  public constructor(slot: string, reference: string) {
    this.#reference = reference
    this.#slot = slot
  }

  public getAttribute(name: string): string | null {
    return name === this.#slot ? this.#reference : null
  }
}

const globals = globalThis as {
  document?: unknown
  location?: unknown
  sessionStorage?: unknown
}

const PAGE_URL = 'https://webview.invalid/settings'

type ErrorFirst = (error: Error | null, result?: unknown) => void

// The SDK call takes a body then a callback, or a callback alone: the
// rest carries whichever the caller sent.
type SdkApi = (method: string, path: string, ...rest: unknown[]) => void

const isCallback = (value: unknown): value is ErrorFirst =>
  typeof value === 'function'

interface Harness {
  api: Mock<SdkApi>
  homey: Homey
  pokes: Map<string, () => void>
  replace: Mock<(url: string) => void>
}

const install = ({
  hashes,
  references,
  spent = null,
}: {
  hashes: Error | Partial<Record<string, string>>
  references: readonly FakeReference[]
  spent?: string | null
}): Harness => {
  const replace = vi.fn<(url: string) => void>()
  const store = new Map<string, string>()
  if (spent !== null) {
    store.set('webview_refetched_for', spent)
  }
  globals.document = {
    visibilityState: 'visible',
    addEventListener: (): void => {
      // The foreground trigger is exercised in webview-freshness.test.ts.
    },
    querySelectorAll: (): readonly FakeReference[] => references,
  }
  globals.location = { href: PAGE_URL, replace }
  globals.sessionStorage = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(key, value)
    },
  }
  const pokes = new Map<string, () => void>()
  const api = vi.fn<SdkApi>((method, path, ...rest): void => {
    const [third, fourth] = rest
    if (method === 'GET' && path === '/webview-hashes' && isCallback(third)) {
      if (hashes instanceof Error) {
        third(hashes)
        return
      }
      third(null, hashes)
      return
    }
    if (method === 'POST' && path === '/boot-error' && isCallback(fourth)) {
      // The breadcrumb channel answers with a FAILURE, as the SDK would
      // for a lost route: the callback must swallow it, or the report
      // would surface where the handshake promised silence.
      fourth(new Error('breadcrumb lost'))
    }
  })
  const homey = mock<Homey>({
    api,
    on: (event: string, listener: () => void): void => {
      pokes.set(event, listener)
    },
  })
  return { api, homey, pokes, replace }
}

const STALE_PAGE = [new FakeReference('src', 'index.js?v=00000000')]
const FRESH_PAGE = [new FakeReference('src', 'index.js?v=bbbb2222')]

describe(watchSettingsFreshness, () => {
  afterEach(() => {
    delete globals.document
    delete globals.location
    delete globals.sessionStorage
  })

  it('should fetch the live hashes over GET /webview-hashes and refetch a stale page', async () => {
    const { api, homey, replace } = install({
      hashes: { settings: 'bbbb2222' },
      references: STALE_PAGE,
    })

    await expect(watchSettingsFreshness(homey)).resolves.toBe(true)

    expect(api).toHaveBeenCalledWith(
      'GET',
      '/webview-hashes',
      expect.any(Function),
    )
    expect(replace).toHaveBeenCalledWith(`${PAGE_URL}?fresh=00000000`)
  })

  it('should compare under the settings entry key', async () => {
    // The live map only answers for `settings`: a wrong entry key would
    // read `undefined` and stay put, so the refetch above and the pass
    // below pin the key together.
    const { homey, replace } = install({
      hashes: { other: '00000000', settings: 'bbbb2222' },
      references: FRESH_PAGE,
    })

    await expect(watchSettingsFreshness(homey)).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should re-check when the app pokes webview_hashes_changed', async () => {
    const { api, homey, pokes } = install({
      hashes: { settings: 'bbbb2222' },
      references: FRESH_PAGE,
    })

    await watchSettingsFreshness(homey)
    const poke = pokes.get('webview_hashes_changed')
    assertDefined(poke)
    poke()

    expect(api.mock.calls.filter(([method]) => method === 'GET')).toHaveLength(
      2,
    )
  })

  it('should ride the boot-error route with a swallowed outcome when the handshake reports', async () => {
    // A spent guard makes the boot check report instead of refetching.
    const { api, homey } = install({
      hashes: { settings: 'bbbb2222' },
      references: STALE_PAGE,
      spent: '00000000',
    })

    await expect(watchSettingsFreshness(homey)).resolves.toBe(false)

    // The boot check's GET is call 0; the breadcrumb POST follows it.
    expect(api).toHaveBeenCalledWith(
      'POST',
      '/boot-error',
      expect.anything(),
      expect.any(Function),
    )

    const breadcrumb = getMockCallArg<{ message: string; name: string }>(
      api,
      1,
      2,
    )

    expect(breadcrumb.name).toBe('WebviewFreshness')
    expect(breadcrumb.message).toContain('Stale webview persists')
  })

  it('should stay put when the hash route fails', async () => {
    const { homey, replace } = install({
      hashes: new Error('unreachable'),
      references: STALE_PAGE,
    })

    await expect(watchSettingsFreshness(homey)).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })
})
