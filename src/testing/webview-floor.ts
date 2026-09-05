/**
 * The webview-floor analysis kernel behind the family's floor-closure
 * suites: the es2023 floor must cover every file a webview bundle can
 * emit — the bundler's entry points plus every module they reach
 * through a VALUE import, since type imports erase at emit and pull
 * nothing into a bundle. A reached file outside the floor globs would
 * ship API the phone engines lack without any lint saying so. Each app
 * extracts its own perimeter (entry points, floor globs) from its own
 * config files and declares its own `describe`/`it` over the findings;
 * the closure walk and the glob matching stay single-sourced here.
 * @packageDocumentation
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { namedGroup } from './named-group.ts'

// One statement spans from `import` to its single `from` clause; the
// lazy quantifier stops at the first, so statements never bleed into
// each other even without semicolons.
const IMPORT_STATEMENT =
  /^import(?<typeOnly> type)? (?<clause>[\s\S]*?)from '(?<specifier>[^']+)'/gmv

const QUOTED_ENTRY = /'(?<entry>[^']+)'/gv

const RELATIVE = /^\.\.?\//v

/**
 * The floor-closure analysis verdict: the emitted closure itself, and
 * the closure files no floor glob covers.
 * @category Testing
 */
export interface WebviewFloorFindings {
  readonly closure: readonly string[]
  readonly uncovered: readonly string[]
}

/**
 * One repo's floor perimeter: the bundler's entry points, the floor
 * globs its lint overlay declares, and the repo root the files resolve
 * against.
 * @category Testing
 */
export interface WebviewFloorPerimeter {
  readonly entryPoints: readonly string[]
  readonly floorGlobs: readonly string[]
  readonly repoRoot: string
}

const byName = (left: string, right: string): number =>
  left.localeCompare(right)

const readRepoFile = (repoRoot: string, relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8')

// Globs escape their dots, park `**/` on a placeholder no glob can
// contain, expand `*`, then expand the parked `**/` — the order keeps
// the two star forms from consuming each other.
const toGlobRegex = (glob: string): RegExp =>
  new RegExp(
    `^${glob
      .replaceAll('.', String.raw`\.`)
      .replaceAll('**/', '\u{1}')
      .replaceAll('*', String.raw`[^\/]*`)
      .replaceAll('\u{1}', String.raw`(?:.*\/)?`)}$`,
    'v',
  )

// The repo-relative files a source file pulls in through value imports.
// A top-level `import type` erases at emit; the matched text carries
// the discrimination, so no optional-group fallback is needed.
const getValueImports = (repoRoot: string, file: string): string[] =>
  readRepoFile(repoRoot, file)
    .matchAll(IMPORT_STATEMENT)
    .filter((statement) => !statement[0].startsWith('import type '))
    .map((statement) => namedGroup(statement, 'specifier'))
    .filter((specifier) => RELATIVE.test(specifier))
    .map((specifier) =>
      path
        .relative(
          repoRoot,
          path.resolve(repoRoot, path.dirname(file), specifier),
        )
        .replaceAll(path.sep, '/'),
    )
    .toArray()

const getEmittedClosure = (
  repoRoot: string,
  seed: readonly string[],
): string[] => {
  const closure = new Set<string>()
  const pending = [...seed]
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (closure.has(file)) {
      continue
    }
    closure.add(file)
    pending.push(...getValueImports(repoRoot, file))
  }
  return [...closure].toSorted(byName)
}

/**
 * Extracts the single-quoted entries of one or more list literals from
 * a config source — the shape both the floor globs and the bundler's
 * entry points are declared in.
 * @param source - The config file's text.
 * @param listPattern - Global pattern whose `entries` group captures a list literal's inside; a pattern without that group throws instead of yielding an empty sweep.
 * @returns The quoted entries, in declaration order.
 * @category Testing
 */
export const getQuotedEntries = (
  source: string,
  listPattern: RegExp,
): string[] =>
  source
    .matchAll(listPattern)
    .flatMap((match) => namedGroup(match, 'entries').matchAll(QUOTED_ENTRY))
    .map((match) => namedGroup(match, 'entry'))
    .toArray()

/**
 * Walks the emitted closure from the entry points through value imports
 * and holds it against the floor globs — the findings a consumer's own
 * `describe`/`it` asserts over (an empty `uncovered` under an inclusion
 * invariant, or exact equality of `closure` against a pinned list).
 * @param perimeter - The entry points, floor globs and repo root.
 * @returns The sorted closure and the files no floor glob covers.
 * @category Testing
 */
export const analyzeWebviewFloor = (
  perimeter: WebviewFloorPerimeter,
): WebviewFloorFindings => {
  const { entryPoints, floorGlobs, repoRoot } = perimeter
  const closure = getEmittedClosure(repoRoot, entryPoints)
  const floorRegexes = floorGlobs.map((glob) => toGlobRegex(glob))
  return {
    closure,
    uncovered: closure.filter((file) =>
      floorRegexes.every((regex) => !regex.test(file)),
    ),
  }
}
