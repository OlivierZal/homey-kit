import { describe, expect, it, vi } from 'vitest'

import {
  assertDefined,
  getMockCallArg,
  mock,
  settleDetached,
} from '../../src/testing/helpers.ts'

// A value the type system cannot narrow by itself, so the assertion
// function has something to narrow.
const maybe = (value?: string): string | undefined => value

describe(assertDefined, () => {
  it('should let a present value through', () => {
    expect(() => {
      assertDefined(maybe('present'))
    }).not.toThrow()
  })

  it('should fail the test on an absent value', () => {
    expect(() => {
      assertDefined(maybe())
    }).toThrow(/undefined/v)
  })
})

describe(getMockCallArg, () => {
  it('should read the argument of the recorded call asked for', () => {
    const spy = vi.fn<(first: string, second: number) => void>()
    spy('a', 1)
    spy('b', 2)

    expect(getMockCallArg<number>(spy, 1, 1)).toBe(2)
  })

  it('should fail the test on a call that was never recorded', () => {
    const spy = vi.fn<() => void>()

    expect(() => getMockCallArg(spy, 0, 0)).toThrow(/undefined/v)
  })

  it('should fail the test on an argument the call did not carry', () => {
    const spy = vi.fn<(only: string) => void>()
    spy('one')

    expect(() => getMockCallArg(spy, 0, 1)).toThrow(/undefined/v)
  })
})

describe(mock, () => {
  it('should hand the overrides back as the full type', () => {
    const overrides = { name: 'partial' }

    expect(mock<{ name: string; other: number }>(overrides)).toBe(overrides)
  })

  it('should default to an empty double', () => {
    expect(mock<{ name: string }>()).toStrictEqual({})
  })
})

describe(settleDetached, () => {
  it('should resolve once a detached microtask chain has settled', async () => {
    const steps: string[] = []
    const detached = (async (): Promise<void> => {
      await Promise.resolve()
      steps.push('first')
      await Promise.resolve()
      steps.push('second')
    })()

    await settleDetached()

    expect(steps).toStrictEqual(['first', 'second'])

    await detached
  })
})
