import { describe, expect, it } from 'vitest'

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

// Compile-time guards: each annotation resolves to `false` the moment
// the surface loosens, and assigning `true` to `false` stops `tsc`. The
// runtime assertions below only keep them referenced — the types erase,
// so no test can observe them at runtime.

const hasStrictGet: TypedManagerSettings<TestSettings>['get'] extends (
  key: string,
) => unknown
  ? false
  : true = true

const hasStrictSet: TypedManagerSettings<TestSettings>['set'] extends (
  key: string,
  value: unknown,
) => void
  ? false
  : true = true

const hasStrictUnset: TypedManagerSettings<TestSettings>['unset'] extends (
  key: string,
) => void
  ? false
  : true = true

const hasUnset: 'unset' extends keyof TypedManagerSettings<TestSettings>
  ? true
  : false = true

const hasNarrowedGet: TypedManagerSettings<TestSettings>['get'] extends (
  key: 'name',
) => string
  ? true
  : false = true

const hasConstrainedSet: TypedManagerSettings<TestSettings>['set'] extends (
  key: 'count',
  value: number,
) => void
  ? true
  : false = true

// A widened `TDriver` would make the wide record assignable again.
const hasNarrowedDrivers: Record<string, object> extends ReturnType<
  TypedManagerDrivers<TestDriver>['getDrivers']
>
  ? false
  : true = true

describe('the typed manager surfaces', () => {
  it('refuses dynamic string keys on every settings member', () => {
    expect([hasStrictGet, hasStrictSet, hasStrictUnset]).toStrictEqual([
      true,
      true,
      true,
    ])
  })

  it('narrows known keys and declares unset', () => {
    expect([hasNarrowedGet, hasConstrainedSet, hasUnset]).toStrictEqual([
      true,
      true,
      true,
    ])
  })

  it('narrows the drivers record to the app driver', () => {
    expect(hasNarrowedDrivers).toBe(true)
  })

  it('ships no runtime code', async () => {
    const subpath: object = await import('../../src/types/homey.ts')

    expect(Object.keys(subpath)).toHaveLength(0)
  })
})
