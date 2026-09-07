import { describe, expect, it, vi } from 'vitest'

import {
  type SettingManager,
  type SettingStore,
  createSettingManager,
} from '../../src/setting-manager.ts'

type Key = 'homeUsername' | 'username'

// The com.melcloud shape: the library's bare key, prefixed into the
// app's namespaced one at the boundary.
const prefixKey = (key: string): Key =>
  key === 'username' ? 'homeUsername' : 'username'

const createStore = (
  stored: unknown,
): { manager: SettingManager; store: SettingStore<Key> } => {
  const store: SettingStore<Key> = {
    get: vi.fn<SettingStore<Key>['get']>().mockReturnValue(stored),
    set: vi.fn<SettingStore<Key>['set']>(),
    unset: vi.fn<SettingStore<Key>['unset']>(),
  }
  return { manager: createSettingManager(store, prefixKey), store }
}

describe(createSettingManager, () => {
  it('should read a stored string through the mapped key', () => {
    const { manager, store } = createStore('alice')

    expect(manager.get('username')).toBe('alice')
    expect(store.get).toHaveBeenCalledExactlyOnceWith('homeUsername')
  })

  it('should read an absent key as null', () => {
    const { manager } = createStore(null)

    expect(manager.get('username')).toBeNull()
  })

  it.each([
    { kind: 'a number', stored: 42 },
    { kind: 'an object', stored: { nested: true } },
    { kind: 'undefined', stored: undefined },
  ])('should read $kind as undefined', ({ stored }) => {
    const { manager } = createStore(stored)

    expect(manager.get('username')).toBeUndefined()
  })

  it('should write through the mapped key', () => {
    const { manager, store } = createStore(null)

    manager.set('username', 'alice')

    expect(store.set).toHaveBeenCalledExactlyOnceWith('homeUsername', 'alice')
  })

  it('should unset through the mapped key', () => {
    const { manager, store } = createStore(null)

    manager.unset('username')

    expect(store.unset).toHaveBeenCalledExactlyOnceWith('homeUsername')
  })
})
