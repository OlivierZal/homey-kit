/**
 * The plain-string settings contract the API libraries persist a
 * session through (their `SettingManager`), restated structurally so
 * the kit names no SDK package: a stored string reads back as itself,
 * an absent key as `null` or `undefined`.
 * @category Utilities
 */
export interface SettingManager {
  /**
   * Reads a stored string; `null` or `undefined` when absent.
   */
  readonly get: (key: string) => string | null | undefined
  /**
   * Stores a string.
   */
  readonly set: (key: string, value: string) => void
  /**
   * Removes a key.
   */
  readonly unset: (key: string) => void
}

/**
 * The typed settings surface an app's augmented `homey.settings`
 * presents: every member takes the app's own keys, as
 * `TypedManagerSettings` declares them — never `string`.
 * @template TKey - The app's setting keys.
 * @category Utilities
 */
export interface SettingStore<TKey extends string> {
  /**
   * The SDK read; untyped, as every settings read is.
   */
  readonly get: (key: TKey) => unknown
  /**
   * The SDK write of a string value.
   */
  readonly set: (key: TKey, value: string) => void
  /**
   * The SDK removal.
   */
  readonly unset: (key: TKey) => void
}

/**
 * Adapts the app's typed `homey.settings` to the plain-string manager an
 * API library persists its session through.
 *
 * The library derives each key from the accessor its `@setting`
 * decorator wraps, so the key set belongs to the library and grows with
 * its releases; `mapKey` is the ONE boundary where such a key becomes
 * one of the app's — a prefix, or the bare narrowing — and the app keeps
 * that mapper, and the comment explaining it, beside its own settings
 * type. There is no identity default: a store keyed by `string` would
 * be the escape hatch `TypedManagerSettings` refuses. Reads coerce: the
 * library expects a string or nothing, so a value of another type stored
 * under a shared key reads as absent rather than as a string it is not.
 * @template TKey - The app's setting keys.
 * @param settings - The app's `homey.settings`.
 * @param mapKey - Narrows a library key to one of the app's own.
 * @returns The manager the library accepts.
 * @category Utilities
 */
export const createSettingManager = <TKey extends string>(
  settings: SettingStore<TKey>,
  mapKey: (key: string) => TKey,
): SettingManager => ({
  get: (key: string): string | null | undefined => {
    const value = settings.get(mapKey(key))
    return typeof value === 'string' || value === null ? value : undefined
  },
  set: (key: string, value: string): void => {
    settings.set(mapKey(key), value)
  },
  unset: (key: string): void => {
    settings.unset(mapKey(key))
  },
})
