import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  analyzeWebviewFloor,
  getQuotedEntries,
} from '../../src/testing/webview-floor.ts'

// The fixture tree: an entry point carrying a type-only import (erased
// at emit), an inline type specifier (retained at emit, so walked), a
// multi-line value import, a value import crossing directories and a
// bare specifier, plus a cycle between the helper and the shared consts
// — the walk must dedupe and terminate on it.
const REPO_ROOT = fileURLToPath(new URL('../fixtures/floor/', import.meta.url))

const ENTRY_POINTS = ['pages/entry.mts']

const CLOSURE = [
  'inline-types.mts',
  'pages/entry.mts',
  'pages/lib/helper.mts',
  'shared/consts.mts',
]

const analyze = (floorGlobs: readonly string[]): readonly string[] =>
  analyzeWebviewFloor({
    entryPoints: ENTRY_POINTS,
    floorGlobs,
    repoRoot: REPO_ROOT,
  }).uncovered

describe(analyzeWebviewFloor, () => {
  it('should walk value imports only, once per file, across a cycle', () => {
    expect(
      analyzeWebviewFloor({
        entryPoints: ENTRY_POINTS,
        floorGlobs: ['**/*.mts'],
        repoRoot: REPO_ROOT,
      }),
    ).toStrictEqual({ closure: CLOSURE, uncovered: [] })
  })

  it('should report the closure files no floor glob covers', () => {
    expect(analyze(['pages/*.mts'])).toStrictEqual([
      'inline-types.mts',
      'pages/lib/helper.mts',
      'shared/consts.mts',
    ])
  })

  it('should expand `**/` to any depth, including none', () => {
    expect(
      analyze(['*.mts', 'pages/**/*.mts', 'shared/consts.mts']),
    ).toStrictEqual([])
  })

  it('should keep `*` within one path segment', () => {
    expect(analyze(['*.mts'])).toStrictEqual([
      'pages/entry.mts',
      'pages/lib/helper.mts',
      'shared/consts.mts',
    ])
  })
})

describe(getQuotedEntries, () => {
  // The two declaration shapes the apps use, each key also mentioned
  // where it declares nothing (a comment before, a use as a value
  // after), and a comment inside one list carrying a quote.
  const source = [
    '// The entryPoints below feed the bundler; webviewFloorFiles the lint.',
    "const entryPoints = ['settings/index.mts', 'widgets/charts/public/index.mts']",
    'webviewFloorFiles: [',
    "  'public/**/*.mts',",
    "  // A cross-surface file: don't drop it from the floor.",
    "  'types/widgets.mts',",
    '],',
    'build({ entryPoints: [entryPoint] })',
  ].join('\n')

  it('should read the assigned list, passing over a mention in a comment', () => {
    expect(getQuotedEntries(source, 'entryPoints')).toStrictEqual([
      'settings/index.mts',
      'widgets/charts/public/index.mts',
    ])
  })

  it('should read a property list across its lines, ignoring its comment lines', () => {
    expect(getQuotedEntries(source, 'webviewFloorFiles')).toStrictEqual([
      'public/**/*.mts',
      'types/widgets.mts',
    ])
  })

  it('should pass over a use of the key that opens no list', () => {
    expect(
      getQuotedEntries(
        "use(entryPoints)\nentryPoints=['x.mts']",
        'entryPoints',
      ),
    ).toStrictEqual(['x.mts'])
  })

  it('should throw on a key that introduces no list literal', () => {
    expect(() => getQuotedEntries(source, 'floorGlobs')).toThrow(
      /`floorGlobs` introduces no list literal/v,
    )
  })

  it('should throw on a key whose list never closes', () => {
    expect(() =>
      getQuotedEntries("entryPoints = ['a.mts'", 'entryPoints'),
    ).toThrow(/`entryPoints` introduces no list literal/v)
  })
})
