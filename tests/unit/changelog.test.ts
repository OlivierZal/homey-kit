import { describe, expect, it } from 'vitest'

import { selectChangelogEntries } from '../../src/changelog.ts'

const changelog = {
  '1.0.0': { en: 'one', fr: 'un' },
  '1.10.0': { en: 'ten', fr: 'dix' },
  '1.9.0': { en: 'nine', fr: 'neuf' },
  '2.0.0': { en: 'two', fr: 'deux' },
}

describe(selectChangelogEntries, () => {
  it('should select the versions after the announced one, oldest first', () => {
    expect(
      selectChangelogEntries({
        changelog,
        from: '1.0.0',
        language: 'fr',
        to: '2.0.0',
      }),
    ).toStrictEqual({
      entries: [
        { excerpt: 'neuf', version: '1.9.0' },
        { excerpt: 'dix', version: '1.10.0' },
        { excerpt: 'deux', version: '2.0.0' },
      ],
      omitted: 0,
    })
  })

  it('should order by version rather than by key, so 1.10.0 follows 1.9.0', () => {
    const { entries } = selectChangelogEntries({
      changelog: { '1.10.0': { en: 'ten' }, '1.9.0': { en: 'nine' } },
      from: '1.0.0',
      language: 'en',
      to: '2.0.0',
    })

    expect(entries.map(({ version }) => version)).toStrictEqual([
      '1.9.0',
      '1.10.0',
    ])
  })

  it('should exclude the announced version and anything past the running one', () => {
    const { entries } = selectChangelogEntries({
      changelog,
      from: '1.9.0',
      language: 'en',
      to: '1.10.0',
    })

    expect(entries).toStrictEqual([{ excerpt: 'ten', version: '1.10.0' }])
  })

  it('should announce only the running version on a first install', () => {
    expect(
      selectChangelogEntries({
        changelog,
        from: undefined,
        language: 'fr',
        to: '2.0.0',
      }),
    ).toStrictEqual({
      entries: [{ excerpt: 'deux', version: '2.0.0' }],
      omitted: 0,
    })
  })

  it('should treat a null stored version as a first install', () => {
    const { entries } = selectChangelogEntries({
      changelog,
      from: null,
      language: 'en',
      to: '2.0.0',
    })

    expect(entries).toStrictEqual([{ excerpt: 'two', version: '2.0.0' }])
  })

  it('should treat an unreadable stored version as a first install', () => {
    const { entries } = selectChangelogEntries({
      changelog,
      from: 'not-a-version',
      language: 'en',
      to: '2.0.0',
    })

    expect(entries).toStrictEqual([{ excerpt: 'two', version: '2.0.0' }])
  })

  it('should announce nothing when the running version has no entry on a first install', () => {
    expect(
      selectChangelogEntries({
        changelog,
        from: undefined,
        language: 'en',
        to: '3.0.0',
      }),
    ).toStrictEqual({ entries: [], omitted: 0 })
  })

  it('should announce nothing when the running version is unreadable', () => {
    expect(
      selectChangelogEntries({
        changelog,
        from: '1.0.0',
        language: 'en',
        to: 'unknown',
      }),
    ).toStrictEqual({ entries: [], omitted: 0 })
  })

  it('should announce nothing when the stored version is already the running one', () => {
    expect(
      selectChangelogEntries({
        changelog,
        from: '2.0.0',
        language: 'en',
        to: '2.0.0',
      }),
    ).toStrictEqual({ entries: [], omitted: 0 })
  })

  it('should announce nothing on a downgrade', () => {
    expect(
      selectChangelogEntries({
        changelog,
        from: '2.0.0',
        language: 'en',
        to: '1.0.0',
      }),
    ).toStrictEqual({ entries: [], omitted: 0 })
  })

  it('should fall back to English when the language is missing', () => {
    const { entries } = selectChangelogEntries({
      changelog: { '2.0.0': { en: 'two' } },
      from: '1.0.0',
      language: 'da',
      to: '2.0.0',
    })

    expect(entries).toStrictEqual([{ excerpt: 'two', version: '2.0.0' }])
  })

  it('should skip a version translated into neither language without ending the series', () => {
    const { entries } = selectChangelogEntries({
      changelog: {
        '1.5.0': { fr: 'cinq' },
        '1.9.0': { ko: '구' },
        '2.0.0': { en: 'two' },
      },
      from: '1.0.0',
      language: 'fr',
      to: '2.0.0',
    })

    expect(entries).toStrictEqual([
      { excerpt: 'cinq', version: '1.5.0' },
      { excerpt: 'two', version: '2.0.0' },
    ])
  })

  it('should skip a version whose entry is absent', () => {
    const { entries } = selectChangelogEntries({
      changelog: { '1.5.0': undefined, '2.0.0': { en: 'two' } },
      from: '1.0.0',
      language: 'en',
      to: '2.0.0',
    })

    expect(entries).toStrictEqual([{ excerpt: 'two', version: '2.0.0' }])
  })

  it('should ignore an unreadable version key', () => {
    const { entries } = selectChangelogEntries({
      changelog: { '2.0.0': { en: 'two' }, latest: { en: 'nope' } },
      from: '1.0.0',
      language: 'en',
      to: '2.0.0',
    })

    expect(entries).toStrictEqual([{ excerpt: 'two', version: '2.0.0' }])
  })

  it('should keep the five most recent and report the rest as omitted', () => {
    const { entries, omitted } = selectChangelogEntries({
      changelog: Object.fromEntries(
        Array.from({ length: 7 }, (_value, index) => [
          `1.${String(index)}.0`,
          { en: `entry ${String(index)}` },
        ]),
      ),
      from: '1.0.0',
      language: 'en',
      to: '1.6.0',
    })

    expect(entries.map(({ version }) => version)).toStrictEqual([
      '1.2.0',
      '1.3.0',
      '1.4.0',
      '1.5.0',
      '1.6.0',
    ])
    expect(omitted).toBe(1)
  })
})
