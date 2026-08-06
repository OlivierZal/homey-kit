import { expect } from 'vitest'

// TS requires an explicit type annotation on the called identifier for
// asserts predicates; an annotated arrow satisfies that.
export const assertDefined: <T>(value: T | undefined) => asserts value is T = (
  value,
) => {
  expect(value).toBeDefined()
}

// The one sanctioned partial-double boundary: overload resolution hands
// the caller a `T` while the implementation returns the overrides
// untouched — the type refusal a full construction would raise is the
// concession, kept here rather than spread over call sites.
export function mock<T>(overrides?: Partial<Record<keyof T, unknown>>): T
export function mock(overrides: object = {}): unknown {
  return overrides
}
