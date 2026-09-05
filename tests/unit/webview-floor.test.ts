import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  analyzeWebviewFloor,
  getQuotedEntries,
} from '../../src/testing/webview-floor.ts'

// The fixture tree: an entry point carrying a type-only import (erased
// at emit), a multi-line value import, a value import crossing
// directories and a bare specifier, plus a cycle between the helper and
// the shared consts — the walk must dedupe and terminate on it.
const REPO_ROOT = fileURLToPath(new URL('../fixtures/floor/', import.meta.url))

const ENTRY_POINTS = ['pages/entry.mts']

const CLOSURE = ['pages/entry.mts', 'pages/lib/helper.mts', 'shared/consts.mts']

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
      'pages/lib/helper.mts',
      'shared/consts.mts',
    ])
  })

  it('should expand `**/` to any depth, including none', () => {
    expect(analyze(['pages/**/*.mts', 'shared/consts.mts'])).toStrictEqual([])
  })

  it('should keep `*` within one path segment', () => {
    expect(analyze(['*.mts'])).toStrictEqual(CLOSURE)
  })
})

describe(getQuotedEntries, () => {
  // The two declaration shapes the apps use, a comment inside one list,
  // and a later use of the same key that is not a declaration.
  const source = [
    "const entryPoints = ['settings/index.mts', 'widgets/charts/public/index.mts']",
    'webviewFloorFiles: [',
    "  'public/**/*.mts',",
    '  // A cross-surface file, held to the floor on purpose.',
    "  'types/widgets.mts',",
    '],',
    'build({ entryPoints: [entryPoint] })',
  ].join('\n')

  it('should read the quoted entries of an assigned list, in order', () => {
    expect(getQuotedEntries(source, 'entryPoints')).toStrictEqual([
      'settings/index.mts',
      'widgets/charts/public/index.mts',
    ])
  })

  it('should read a property list across its lines and comments', () => {
    expect(getQuotedEntries(source, 'webviewFloorFiles')).toStrictEqual([
      'public/**/*.mts',
      'types/widgets.mts',
    ])
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
