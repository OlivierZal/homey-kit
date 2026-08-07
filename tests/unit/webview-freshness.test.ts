import { type Mock, afterEach, describe, expect, it, vi } from 'vitest'

import {
  ensureFreshWebview,
  getPageIdentity,
  watchWebviewFreshness,
} from '../../src/webview/webview-freshness.ts'

// The helper reads narrow slices of the page (its stamped references,
// sessionStorage, location), so plain doubles installed on globalThis
// are enough — no DOM environment.
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

const PAGE_URL = 'https://webview.invalid/page'

interface Page {
  replace: Mock<(url: string) => void>
  store: Map<string, string>
  hide: () => void
  resume: () => void
}

const install = ({
  href = PAGE_URL,
  isListenerDenied = false,
  isStorageDenied = false,
  isWriteDenied = false,
  references,
  stored = null,
}: {
  references: readonly FakeReference[]
  href?: string
  isListenerDenied?: boolean
  isStorageDenied?: boolean
  isWriteDenied?: boolean
  stored?: string | null
}): Page => {
  const replace = vi.fn<(url: string) => void>()
  const store = new Map<string, string>()
  if (stored !== null) {
    store.set('webview_refetched_for', stored)
  }
  const listeners = new Map<string, () => void>()
  const page = {
    visibilityState: 'visible',
    addEventListener: (type: string, listener: () => void): void => {
      if (isListenerDenied) {
        throw new Error('denied')
      }
      listeners.set(type, listener)
    },
    querySelectorAll: (): readonly FakeReference[] => references,
  }
  globals.document = page
  globals.location = { href, replace }
  globals.sessionStorage = {
    getItem: (key: string): string | null => {
      if (isStorageDenied) {
        throw new Error('denied')
      }
      return store.get(key) ?? null
    },
    setItem: (key: string, value: string): void => {
      if (isStorageDenied || isWriteDenied) {
        throw new Error('denied')
      }
      store.set(key, value)
    },
  }
  return {
    replace,
    store,
    hide: (): void => {
      page.visibilityState = 'hidden'
    },
    resume: (): void => {
      listeners.get('visibilitychange')?.()
    },
  }
}

// The live identity is the DOCUMENT-ORDER join of the page's stamps.
const HASHES = {
  'ata-group-setting': 'cccc0000.aaaa1111',
  settings: 'bbbb2222',
}
const serveHashes = vi
  .fn<() => Promise<Partial<Record<string, string>>>>()
  .mockResolvedValue(HASHES)
const STALE_PAGE = [
  new FakeReference('href', 'styles/layout.css?v=cccc0000'),
  new FakeReference('src', 'index.js?v=00000000'),
]
const FRESH_PAGE = [
  new FakeReference('href', 'styles/layout.css?v=cccc0000'),
  new FakeReference('src', 'index.js?v=aaaa1111'),
]

describe(ensureFreshWebview, () => {
  afterEach(() => {
    delete globals.document
    delete globals.location
    delete globals.sessionStorage
  })

  it('should refetch a stale page through a never-cached address', async () => {
    const { replace, store } = install({ references: STALE_PAGE })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(true)

    // A fresh query key forces a network fetch — a bare reload can be
    // served the same stale document from the HTTP cache.
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith(`${PAGE_URL}?fresh=cccc0000.00000000`)
    expect(store.get('webview_refetched_for')).toBe('cccc0000.00000000')
  })

  it('should overwrite a previous fresh key instead of accumulating', async () => {
    const { replace } = install({
      href: `${PAGE_URL}?fresh=deadbeef`,
      references: STALE_PAGE,
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(true)

    expect(replace).toHaveBeenCalledWith(`${PAGE_URL}?fresh=cccc0000.00000000`)
  })

  it('should report the identities alongside the refetch', async () => {
    const report = vi.fn<(message: string) => void>()
    install({ references: STALE_PAGE })

    await ensureFreshWebview('ata-group-setting', serveHashes, report)

    expect(report).toHaveBeenCalledWith(
      'Stale webview: page cccc0000.00000000, live cccc0000.aaaa1111 — refetching',
    )
  })

  it('should not refetch when the page identity is live', async () => {
    const { replace } = install({ references: FRESH_PAGE })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should not refetch twice for the same stale identity', async () => {
    const { replace } = install({
      references: STALE_PAGE,
      stored: 'cccc0000.00000000',
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should report a mismatch that survived its refetch', async () => {
    const report = vi.fn<(message: string) => void>()
    const { replace } = install({
      references: STALE_PAGE,
      stored: 'cccc0000.00000000',
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes, report),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith(
      'Stale webview persists after its refetch: page cccc0000.00000000, live cccc0000.aaaa1111',
    )
  })

  it('should stay put on an unstamped page', async () => {
    const { replace } = install({ references: [] })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should ignore an element carrying neither reference attribute', async () => {
    // Defensive arm: the selector guarantees one attribute in a real
    // DOM; a double that matches neither must contribute nothing.
    const { replace } = install({
      references: [new FakeReference('data-src', 'index.js?v=aaaa1111')],
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should ignore references whose stamp is off-shape', async () => {
    const { replace } = install({
      references: [new FakeReference('src', 'index.js?v=NOT-A-HASH')],
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should stay put when its entry is not served', async () => {
    const { replace } = install({ references: STALE_PAGE })

    await expect(ensureFreshWebview('charts', serveHashes)).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should stay put when fetching the hashes fails', async () => {
    const { replace } = install({ references: STALE_PAGE })

    await expect(
      ensureFreshWebview(
        'ata-group-setting',
        vi
          .fn<() => Promise<Partial<Record<string, string>>>>()
          .mockRejectedValue(new Error('route absent')),
      ),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should skip the refetch when the guard cannot be written', async () => {
    const report = vi.fn<(message: string) => void>()
    const { replace } = install({ isWriteDenied: true, references: STALE_PAGE })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes, report),
    ).resolves.toBe(false)

    // Navigating without a persisted guard risks a boot-navigation
    // livelock: the address is deterministic per identity, so a cached
    // response to it would be re-attempted on every boot.
    expect(replace).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith(
      'Stale webview: page cccc0000.00000000, live cccc0000.aaaa1111 — guard unwritable, refetch skipped',
    )
  })

  it('should skip the refetch and say so when storage is denied', async () => {
    const report = vi.fn<(message: string) => void>()
    const { replace } = install({
      isStorageDenied: true,
      references: STALE_PAGE,
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes, report),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
    // Denied storage is its own outcome — reporting it as a spent
    // refetch would claim an attempt that never happened.
    expect(report).toHaveBeenCalledWith(
      'Stale webview: page cccc0000.00000000, live cccc0000.aaaa1111 — storage denied, refetch skipped',
    )
  })

  it('should keep the page booting when the navigation fails', async () => {
    const report = vi.fn<(message: string) => void>()
    const { replace } = install({ references: STALE_PAGE })
    replace.mockImplementation(() => {
      throw new Error('blocked')
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes, report),
    ).resolves.toBe(false)

    expect(report).toHaveBeenCalledWith(
      'Stale webview refetch could not navigate: page cccc0000.00000000',
    )
  })
})

describe(getPageIdentity, () => {
  afterEach(() => {
    delete globals.document
  })

  it('should join the stamps in document order', () => {
    install({ references: STALE_PAGE })

    expect(getPageIdentity()).toBe('cccc0000.00000000')
  })

  it('should report no identity on an unstamped page', () => {
    install({ references: [] })

    expect(getPageIdentity()).toBeNull()
  })
})

// FRESH_PAGE's identity served back, so the boot check finds the page
// live; the app then ships a new bundle and the served hash moves.
const serving = (
  hashes: Partial<Record<string, string>>,
): Mock<() => Promise<Partial<Record<string, string>>>> =>
  vi
    .fn<() => Promise<Partial<Record<string, string>>>>()
    .mockResolvedValue(hashes)

const LIVE = { 'ata-group-setting': 'cccc0000.aaaa1111' }
const MOVED = { 'ata-group-setting': 'cccc0000.99999999' }

// The triggers detach their check, so the assertions wait one macrotask
// for the microtask queue to drain — deterministic, unlike polling.
const settled = async (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

const options = (
  fetchHashes: () => Promise<Partial<Record<string, string>>>,
  extra: {
    report?: (message: string) => void
    subscribe?: (onPoke: () => void) => void
  } = {},
): Parameters<typeof watchWebviewFreshness>[0] => ({
  entry: 'ata-group-setting',
  fetchHashes,
  ...extra,
})

const moving = (): Mock<() => Promise<Partial<Record<string, string>>>> =>
  vi
    .fn<() => Promise<Partial<Record<string, string>>>>()
    .mockResolvedValueOnce(LIVE)
    .mockResolvedValue(MOVED)

describe(watchWebviewFreshness, () => {
  afterEach(() => {
    delete globals.document
    delete globals.location
    delete globals.sessionStorage
  })

  it('should refetch straight away when the boot check finds the page stale', async () => {
    const { replace } = install({ references: STALE_PAGE })

    await expect(watchWebviewFreshness(options(serving(HASHES)))).resolves.toBe(
      true,
    )

    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('should re-check a surviving page when it returns to the foreground', async () => {
    // The measured gap: a mobile webview outlives the app restart, so
    // no new document — and so no boot check — ever happens.
    const { replace, resume } = install({ references: FRESH_PAGE })

    await expect(watchWebviewFreshness(options(moving()))).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()

    resume()
    await settled()

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith(`${PAGE_URL}?fresh=cccc0000.aaaa1111`)
  })

  it('should ignore a visibility change that does not bring the page forward', async () => {
    const { hide, replace, resume } = install({ references: FRESH_PAGE })
    const serve = moving()

    await watchWebviewFreshness(options(serve))
    hide()
    resume()
    await settled()

    expect(serve).toHaveBeenCalledTimes(1)
    expect(replace).not.toHaveBeenCalled()
  })

  it('should navigate once however often the page returns', async () => {
    const { replace, resume } = install({ references: STALE_PAGE })

    await watchWebviewFreshness(options(serving(HASHES)))
    resume()
    resume()
    resume()
    await settled()

    // The per-identity guard bounds the navigation, and a page already
    // refetching stops checking altogether.
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('should re-check through the app poke when a channel is given', async () => {
    const { replace } = install({ references: FRESH_PAGE })
    let poke: (() => void) | undefined

    await watchWebviewFreshness(
      options(moving(), {
        subscribe: (onPoke): void => {
          poke = onPoke
        },
      }),
    )
    poke?.()
    await settled()

    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('should collapse a breadcrumb repeated by every return', async () => {
    const report = vi.fn<(message: string) => void>()
    const { resume } = install({
      references: STALE_PAGE,
      stored: 'cccc0000.00000000',
    })

    await watchWebviewFreshness(options(serving(HASHES), { report }))
    resume()
    resume()
    await settled()

    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith(
      'Stale webview persists after its refetch: page cccc0000.00000000, live cccc0000.aaaa1111',
    )
  })

  it('should keep the page booting when visibility cannot be observed', async () => {
    const { replace } = install({
      isListenerDenied: true,
      references: STALE_PAGE,
    })

    await expect(watchWebviewFreshness(options(serving(HASHES)))).resolves.toBe(
      true,
    )

    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('should keep the page booting when the boot check throws', async () => {
    install({ references: STALE_PAGE })
    globals.document = {
      visibilityState: 'visible',
      addEventListener: (): void => undefined,
      querySelectorAll: (): never => {
        throw new Error('detached')
      },
    }

    await expect(watchWebviewFreshness(options(serving(HASHES)))).resolves.toBe(
      false,
    )
  })

  it('should turn a re-check that throws into a breadcrumb', async () => {
    const report = vi.fn<(message: string) => void>()
    const { resume } = install({ references: FRESH_PAGE })

    await watchWebviewFreshness(options(serving(LIVE), { report }))
    // The page detaches under the listener: reading its stamps throws,
    // and the rejection must die inside the watcher.
    globals.document = {
      visibilityState: 'visible',
      querySelectorAll: (): never => {
        throw new Error('detached')
      },
    }
    resume()
    await settled()

    expect(report).toHaveBeenCalledWith(
      expect.stringContaining('Webview freshness re-check failed:'),
    )
  })
})
