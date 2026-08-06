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
})
