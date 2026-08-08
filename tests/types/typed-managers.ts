/**
 * Compile-time guards over the `./types` surface. Each annotation
 * resolves to `false` the moment the surface loosens, and assigning
 * `true` to `false` stops `tsc` — so these are checked by `typecheck`,
 * not by the test run. A runtime assertion could not see any of it: the
 * types erase, leaving a tautology that asserts nothing.
 */
import type {
  TypedManagerDrivers,
  TypedManagerSettings,
} from '../../src/types/homey.ts'

interface TestDriver {
  readonly id: string
}

interface TestSettings {
  readonly count: number
  readonly name: string
}

export const hasStrictGet: TypedManagerSettings<TestSettings>['get'] extends (
  key: string,
) => unknown
  ? false
  : true = true

export const hasStrictSet: TypedManagerSettings<TestSettings>['set'] extends (
  key: string,
  value: unknown,
) => void
  ? false
  : true = true

export const hasStrictUnset: TypedManagerSettings<TestSettings>['unset'] extends (
  key: string,
) => void
  ? false
  : true = true

export const hasUnset: 'unset' extends keyof TypedManagerSettings<TestSettings>
  ? true
  : false = true

export const hasNarrowedGet: TypedManagerSettings<TestSettings>['get'] extends (
  key: 'name',
) => string
  ? true
  : false = true

export const hasConstrainedSet: TypedManagerSettings<TestSettings>['set'] extends (
  key: 'count',
  value: number,
) => void
  ? true
  : false = true

// A widened `TDriver` would make the wide record assignable again.
export const hasNarrowedDrivers: Record<string, object> extends ReturnType<
  TypedManagerDrivers<TestDriver>['getDrivers']
>
  ? false
  : true = true
