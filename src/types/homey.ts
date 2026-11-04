/**
 * The generic halves of an app's typed `Homey`. Since the SDK types 1.x
 * the one augmentation seam is `declare module 'homey' { interface
 * HomeyTypes { app: MyApp } }`, which types `homey.app` and nothing
 * else; the managers are narrowed app-side, by interfaces that extend
 * the SDK's manager classes and take their member SIGNATURES from these
 * generics, gathered into an app-level `interface MyHomey extends Homey`
 * that the app class re-declares `homey` with — shown in the README.
 * @packageDocumentation
 */

/**
 * Typed `ManagerDrivers` surface: `getDrivers` narrowed to the app's
 * driver class.
 * @template TDriver - The app's driver class.
 * @category Types
 */
export interface TypedManagerDrivers<TDriver> {
  /**
   * The SDK read, narrowed to the app's driver class.
   */
  getDrivers: () => Record<string, TDriver>
}

/**
 * Typed `ManagerSettings` surface: every member accepts the app's own
 * keys and nothing else, so a typo or a stale key is a compile error
 * rather than an `undefined` read at runtime.
 *
 * There is deliberately no `(key: string)` escape hatch. Code that must
 * address settings dynamically — an adapter satisfying a third-party
 * interface that imposes `key: string` — narrows at that boundary, in
 * one visible place, instead of widening the type for every call site
 * in the app. The boundary is where the knowledge lives: only the
 * adapter knows the keys it forwards are real.
 * @template TSettings - The app's settings shape.
 * @category Types
 */
export interface TypedManagerSettings<TSettings extends object> {
  /**
   * The SDK read, narrowed to the app's settings shape.
   */
  get: <T extends keyof TSettings>(key: T) => TSettings[T]
  /**
   * The SDK write, constraining the value to the key's own type.
   */
  set: <T extends keyof TSettings>(key: T, value: TSettings[T]) => void
  /**
   * The SDK removal, narrowed to the app's settings shape.
   */
  unset: (key: keyof TSettings) => void
}
