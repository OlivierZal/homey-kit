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
 *
 * The walk follows `import … from` statements only: a side-effect
 * import (`import './x'`) or a re-export (`export … from './x'`) is not
 * an edge it knows, and an inline type specifier (`import { type X }`)
 * counts as a value edge — under `verbatimModuleSyntax` the statement
 * is retained and the module bundled. No app's webview code uses the
 * first two shapes (measured 2026-09); teach the walk before one does.
 * @packageDocumentation
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { namedGroup } from '../named-group.ts'

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

const NOT_FOUND = -1

const byName = (left: string, right: string): number =>
  left.localeCompare(right)

// `indexOf` with its sentinel turned into an absence the callers can
// narrow on instead of comparing against.
const indexAfter = (
  source: string,
  needle: string,
  from?: number,
): number | undefined => {
  const index = source.indexOf(needle, from)
  return index === NOT_FOUND ? undefined : index
}

const readRepoFile = (repoRoot: string, relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8')

// Globs escape their dots, park `**/` on a placeholder no glob can
// contain, expand `*`, then expand the parked `**/` — the order keeps
// the two star forms from consuming each other.
const toGlobRegex = (glob: string): RegExp => {
  const body = glob
    .replaceAll('.', String.raw`\.`)
    .replaceAll('**/', '\u{1}')
    .replaceAll('*', String.raw`[^\/]*`)
    .replaceAll('\u{1}', String.raw`(?:.*\/)?`)
  return new RegExp(`^${body}$`, 'v')
}

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

const WHITESPACE = new Set([' ', '\t', '\r', '\n'])

const ASSIGNERS = new Set([':', '='])

const skipWhitespace = (source: string, from: number): number => {
  let index = from
  while (WHITESPACE.has(source.charAt(index))) {
    index += 1
  }
  return index
}

// Where the list a key introduces opens: the key, whitespace, `:` or
// `=`, whitespace, `[` — the two declaration shapes the apps use. Any
// other occurrence of the key (a comment, a later use as a value) is
// passed over.
const findListOpen = (source: string, key: string): number | undefined => {
  let keyIndex = indexAfter(source, key)
  while (keyIndex !== undefined) {
    const assigner = skipWhitespace(source, keyIndex + key.length)
    const open = skipWhitespace(source, assigner + 1)
    if (ASSIGNERS.has(source.charAt(assigner)) && source.charAt(open) === '[') {
      return open
    }
    keyIndex = indexAfter(source, key, keyIndex + 1)
  }
  return undefined
}

// A `//` line inside the list is prose, and prose may hold a quote.
const withoutLineComments = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n')

/**
 * Extracts the single-quoted entries of the list literal a key
 * introduces in a config source — the shape both the floor globs
 * (`webviewFloorFiles: [...]`) and the bundler's entry points
 * (`const entryPoints = [...]`) are declared in. The list is the one the
 * key's first DECLARING occurrence opens (`key: [` or `key = [`,
 * whitespace tolerated; a mention in a comment or a later use is passed
 * over) up to the next `]`, with its `//` comment lines ignored. A key
 * that introduces no list, or a list holding no quoted entry, throws
 * instead of yielding an empty sweep — the guard the apps' suites used
 * to carry by hand.
 * @param source - The config file's text.
 * @param key - The identifier or property name the list is assigned to.
 * @returns The quoted entries, in declaration order — never empty.
 * @throws When the key introduces no list literal, or one with no quoted entry.
 * @category Testing
 */
export const getQuotedEntries = (source: string, key: string): string[] => {
  const open = findListOpen(source, key)
  const close = open === undefined ? undefined : indexAfter(source, ']', open)
  if (open === undefined || close === undefined) {
    throw new Error(`\`${key}\` introduces no list literal in the source`)
  }
  const entries = withoutLineComments(source.slice(open + 1, close))
    .matchAll(QUOTED_ENTRY)
    .map((match) => namedGroup(match, 'entry'))
    .toArray()
  if (entries.length === 0) {
    throw new Error(`\`${key}\` introduces a list with no quoted entry`)
  }
  return entries
}

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
