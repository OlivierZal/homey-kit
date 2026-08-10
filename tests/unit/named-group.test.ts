import { describe, expect, it } from 'vitest'

import { namedGroup } from '../../src/testing/named-group.ts'

const matchOf = (pattern: RegExp, source: string): RegExpExecArray => {
  const match = pattern.exec(source)
  if (match === null) {
    throw new Error(`the fixture pattern did not match \`${source}\``)
  }
  return match
}

describe(namedGroup, () => {
  it('should read a group the pattern declares', () => {
    expect(
      namedGroup(matchOf(/'(?<path>\/\w+)'/v, "get('/thing')"), 'path'),
    ).toBe('/thing')
  })

  // The two shapes a sweep would otherwise read as an empty path: a
  // pattern whose groups no longer include the one asked for, and one
  // that names no group at all.
  it('should throw on a group the pattern does not declare', () => {
    expect(() => namedGroup(matchOf(/(?<verb>get)/v, 'get'), 'path')).toThrow(
      /`path` is not a group of the pattern that matched `get`/v,
    )
  })

  it('should throw on a pattern with no named group', () => {
    expect(() => namedGroup(matchOf(/get/v, 'get'), 'path')).toThrow(
      /`path` is not a group of the pattern that matched `get`/v,
    )
  })
})
