/**
 * Picks the changelog excerpts a user has not been told about yet.
 *
 * An app notifies on boot and stores the version it announced, so a user
 * who updates rarely skips every intermediate release: only the newest
 * one was ever selected. This walks the stored version up to the running
 * one instead, so nothing published in between goes unmentioned.
 * @packageDocumentation
 */

// Validated without a regular expression on purpose: this module sits
// in the root barrel, which webview code also imports, and the repo's
// global rule mandates the es2024 `v` flag that phone engines reject at
// parse time. Tree-shaking keeps it out of those bundles today; not
// writing the trap keeps it out for good.
const PART_COUNT = 3

// A user returning after a long absence gets a readable digest, not a
// wall of notifications; the count that did not fit is reported back so
// the caller can say so rather than drop it silently.
const MAX_ENTRIES = 5

// Store copy is authored in English and translated from it, so English
// is the one language a version is most likely to carry.
const FALLBACK_LANGUAGE = 'en'

// Parts packed into one number, so ordering is the plain numeric
// comparison and `23.10.0` outranks `23.9.0`. Four digits per part sit
// far past any component an app version reaches, and the packed value
// stays well inside the safe integer range.
const PART_SCALE = 10_000

/**
 * One version's user-facing excerpt, in the language that was available.
 * @category Changelog
 */
export interface ChangelogEntry {
  /**
  The excerpt to show.
   */
  readonly excerpt: string
  /**
  The version it describes.
   */
  readonly version: string
}

/**
 * The excerpts to announce, oldest first, and how many the cap dropped.
 * @category Changelog
 */
export interface ChangelogSelection {
  /**
  Excerpts in chronological order — announce them in this order.
   */
  readonly entries: readonly ChangelogEntry[]
  /**
   * Notifiable versions the cap left out, all older than `entries`. Zero
   * on a first install: a fresh user skipped nothing.
   */
  readonly omitted: number
}

/**
 * Inputs to {@link selectChangelogEntries}.
 * @category Changelog
 */
export interface ChangelogSelectionOptions {
  /**
  The parsed `.homeychangelog.json`: version, then language, then excerpt.
   */
  readonly changelog: Partial<Record<string, Partial<Record<string, string>>>>
  /**
  The last version announced, from app settings; absent on a first
  install.
   */
  readonly from: string | null | undefined
  /**
  The user's language; falls back to English per version.
   */
  readonly language: string
  /**
  The running version.
   */
  readonly to: string
}

const NOTHING: ChangelogSelection = { entries: [], omitted: 0 }

// A part is digits only when the number it parses to prints back
// identically: that rejects the empty string, padding, signs, decimals
// and exponent forms in one comparison.
const isVersionPart = (part: string): boolean => {
  const value = Number(part)
  return Number.isSafeInteger(value) && value >= 0 && String(value) === part
}

const versionKey = (version: string): number | null => {
  const parts = version.split('.')
  return parts.length === PART_COUNT &&
    parts.every((part) => isVersionPart(part))
    ? parts.reduce((packed, part) => packed * PART_SCALE + Number(part), 0)
    : null
}

// A version translated into neither the user's language nor English has
// nothing to show, so it drops out of the series instead of ending it.
const pickExcerpt = (
  entry: Partial<Record<string, string>> | undefined,
  language: string,
): string | undefined => entry?.[language] ?? entry?.[FALLBACK_LANGUAGE]

// A fresh install has skipped nothing, so it hears about the version it
// just installed and never about the history behind it.
const selectInstalled = ({
  changelog,
  language,
  to,
}: ChangelogSelectionOptions): ChangelogSelection => {
  const excerpt = pickExcerpt(changelog[to], language)
  return excerpt === undefined
    ? NOTHING
    : { entries: [{ excerpt, version: to }], omitted: 0 }
}

const collectNotifiable = (
  { changelog, language }: ChangelogSelectionOptions,
  baseline: number,
  target: number,
): readonly ChangelogEntry[] =>
  Object.keys(changelog)
    .flatMap((version) => {
      const key = versionKey(version)
      if (key === null || key <= baseline || key > target) {
        return []
      }
      const excerpt = pickExcerpt(changelog[version], language)
      return excerpt === undefined ? [] : [{ excerpt, key, version }]
    })
    .toSorted((left, right) => left.key - right.key)
    .map(({ excerpt, version }) => ({ excerpt, version }))

const selectRange = (
  options: ChangelogSelectionOptions,
  baseline: number,
  target: number,
): ChangelogSelection => {
  const notifiable = collectNotifiable(options, baseline, target)
  const omitted = Math.max(notifiable.length - MAX_ENTRIES, 0)
  return { entries: notifiable.slice(omitted), omitted }
}

/**
 * Selects the excerpts to announce, oldest first.
 *
 * Versions strictly newer than `from` and no newer than `to` qualify,
 * ordered by version rather than by key order — `23.10.0` follows
 * `23.9.0`. A first install (no readable `from`) yields only `to`, so a
 * new user is never handed the whole history, and a downgrade yields
 * nothing.
 * @param options - See {@link ChangelogSelectionOptions}.
 * @returns The excerpts to announce and the count the cap dropped.
 * @category Changelog
 */
export const selectChangelogEntries = (
  options: ChangelogSelectionOptions,
): ChangelogSelection => {
  const { from, to } = options
  const target = versionKey(to)
  if (target === null) {
    return NOTHING
  }
  const baseline = from === null || from === undefined ? null : versionKey(from)
  if (baseline === null) {
    return selectInstalled(options)
  }
  return target <= baseline ? NOTHING : selectRange(options, baseline, target)
}
