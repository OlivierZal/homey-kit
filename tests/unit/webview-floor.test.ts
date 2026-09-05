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
  const source =
    "webviewFloorFiles: ['src/*.ts', 'src/dom/**/*.ts'],\nentryPoints: ['pages/entry.mts']"

  it('should read the quoted entries of the captured list, in order', () => {
    expect(
      getQuotedEntries(source, /webviewFloorFiles: \[(?<entries>[^\]]*)\]/gv),
    ).toStrictEqual(['src/*.ts', 'src/dom/**/*.ts'])
  })

  it('should read across every list the pattern captures', () => {
    expect(
      getQuotedEntries(source, /: \[(?<entries>[^\]]*)\]/gv),
    ).toStrictEqual(['src/*.ts', 'src/dom/**/*.ts', 'pages/entry.mts'])
  })

  it('should throw on a pattern that declares no `entries` group', () => {
    expect(() =>
      getQuotedEntries(source, /webviewFloorFiles: \[(?<list>[^\]]*)\]/gv),
    ).toThrow(/`entries` is not a group of the pattern/v)
  })
})
