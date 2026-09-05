/**
 * The plain test helpers every consuming app's suite rebuilds
 * otherwise: the asserting narrow, the partial-double boundary, the
 * mock-call reader, the CJS-interop shape and the detached-work drain.
 * Runs inside the consumer's vitest process, like the kernels beside
 * it.
 * @packageDocumentation
 */
import { expect } from 'vitest'

/**
 * Shape served by vitest when a CJS `export =` module (like `homey`) is
 * consumed through ESM default imports: the factory must expose the
 * module under a `default` key its declared type does not have.
 * @template TModule - The module's declared type.
 * @category Testing
 */
export type InteropModule<TModule> = TModule & { default: TModule }

/**
 * The recorded calls a mock exposes — the shape every vitest mock
 * carries, named structurally so any mock qualifies without a vitest
 * type at the call site.
 * @category Testing
 */
export interface RecordedCalls {
  readonly mock: { readonly calls: unknown[][] }
}

// TS requires an explicit type annotation on the called identifier for
// asserts predicates; an annotated arrow satisfies that.
/**
 * Narrows a possibly-absent value, failing the test where it is absent.
 * @param value - The value to narrow.
 * @category Testing
 */
export const assertDefined: <T>(value: T | undefined) => asserts value is T = (
  value,
) => {
  expect(value).toBeDefined()
}

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- T is used only in the return type on purpose: the caller names the expected argument type once, here, instead of asserting at every read */
/**
 * Reads one argument of one recorded mock call, failing the test when
 * the call or the argument is absent. The overload hands the caller the
 * expected argument type; the implementation returns the recorded value
 * untouched.
 * @template T - The expected argument type.
 * @param mockFunction - The mock whose calls are read.
 * @param callIndex - Which recorded call to read.
 * @param argIndex - Which argument of that call to return.
 * @returns The recorded argument.
 * @category Testing
 */
export function getMockCallArg<T>(
  mockFunction: RecordedCalls,
  callIndex: number,
  argIndex: number,
): T
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */
export function getMockCallArg(
  mockFunction: RecordedCalls,
  callIndex: number,
  argIndex: number,
): unknown {
  const arg = mockFunction.mock.calls.at(callIndex)?.at(argIndex)
  assertDefined(arg)
  return arg
}

// The one sanctioned partial-double boundary: overload resolution hands
// the caller a `T` while the implementation returns the overrides
// untouched — the type refusal a full construction would raise is the
// concession, kept here rather than spread over call sites.
/**
 * Builds a partial double the caller uses as a full `T`.
 * @template T - The doubled type.
 * @param overrides - The members the test actually exercises.
 * @returns The overrides, typed as the full `T`.
 * @category Testing
 */
export function mock<T>(overrides?: Partial<Record<keyof T, unknown>>): T
export function mock(overrides: object = {}): unknown {
  return overrides
}

/**
 * Drains the microtask chains a detached (fire-and-forget) run leaves
 * behind: one macrotask turn settles them all when the mocks resolve
 * synchronously.
 * @returns Resolves after one macrotask turn.
 * @category Testing
 */
export const settleDetached = async (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve)
  })
