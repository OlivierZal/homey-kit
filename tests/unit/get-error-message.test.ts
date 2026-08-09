import { describe, expect, it } from 'vitest'

import { getErrorMessage } from '../../src/get-error-message.ts'

describe(getErrorMessage, () => {
  it.each([
    [new Error('boom'), 'boom'],
    ['boom', 'boom'],
    [{ code: 42 }, '{"code":42}'],
  ])('should convert %o to %s', (error, expected) => {
    expect(getErrorMessage(error)).toBe(expected)
  })

  // Error paths hand this helper whatever was thrown: values JSON cannot
  // serialize must still come back as a string, never as a second throw.
  it('should fall back to String on a circular value', () => {
    const circular: { self?: unknown } = {}
    circular.self = circular

    expect(getErrorMessage(circular)).toBe('[unserializable value]')
  })

  it('should fall back to String when JSON yields no string', () => {
    expect(getErrorMessage(undefined)).toBe('[unserializable value]')
  })
})
