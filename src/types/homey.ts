/**
 * The generic halves of the per-app `homey-override.d.ts` augmentations:
 * each app declares `module 'homey'` itself (module augmentation cannot
 * be packaged) and extends these interfaces with its own types — about
 * six wiring lines per app, shown in the README.
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
 * Typed `ManagerSettings` surface: `get`/`set` keep the SDK's untyped
 * string signature while known keys narrow to the app's settings shape.
 * @template TSettings - The app's settings shape.
 * @category Types
 */
export interface TypedManagerSettings<TSettings extends object> {
  /**
   * The SDK's untyped read, overloaded so known keys narrow to the
   * app's settings shape.
   */
  get: ((key: string) => unknown) &
    (<T extends keyof TSettings>(key: T) => TSettings[T])
  /**
   * The SDK's untyped write, overloaded so known keys constrain the
   * value to the app's settings shape.
   */
  set: ((key: string, value: unknown) => void) &
    (<T extends keyof TSettings>(key: T, value: TSettings[T]) => void)
}
