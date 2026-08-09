// The call-site half of the family's API contract, single-sourced: a
// consumer's webview sources may only call routes their own surface
// declares. Paths are extracted from the sources — literal ones exactly,
// template-built ones by their fixed chunks — and checked against the
// declared table. Each app supplies its `Surface` table and its own
// `describe`/`it` block asserting over `analyzeRouteGuards` — declaring
// the suite app-side is what keeps every test file visibly a test file.
// The declaration half lives in `findContractBreach`.
import { readdir, readFile } from 'node:fs/promises'

/**
 * One manifest-declared route, the unit every swept call site must
 * match under its own method.
 * @category Testing
 */
export interface DeclaredRoute {
  readonly method: string
  readonly path: string
}

/**
 * The route-guard analysis verdict: undeclared calls by kind, plus the
 * call-site accounting that turns a broken extractor into a failure
 * instead of a silent pass.
 * @category Testing
 */
export interface RouteGuardFindings {
  readonly accountedCallSites: number
  readonly parsedOrIndirectCalls: number
  readonly undeclaredMethodCalls: readonly string[]
  readonly undeclaredPaths: readonly string[]
  readonly undeclaredTemplateCalls: readonly string[]
}

/**
 * One webview surface to sweep: its manifest and the source directories
 * whose `homeyApi*` call sites the guard must account for.
 * @category Testing
 */
export interface Surface {
  readonly manifest: string
  readonly name: string
  readonly sourceDirs: readonly string[]
}

// Boundary guard: the manifest is caller-controlled JSON, so each api
// entry is checked for the route shape instead of asserted into it.
const isDeclaredRoute = (value: unknown): value is DeclaredRoute =>
  typeof value === 'object' &&
  value !== null &&
  'method' in value &&
  typeof value.method === 'string' &&
  'path' in value &&
  typeof value.path === 'string'

// A route the guard cannot read is a route it cannot police, so a
// malformed manifest throws instead of yielding fewer routes: dropping
// the entry would turn a broken declaration into a silent pass.
const readRoutes = async (manifestPath: string): Promise<DeclaredRoute[]> => {
  const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('api' in manifest) ||
    typeof manifest.api !== 'object' ||
    manifest.api === null
  ) {
    throw new Error(
      `${manifestPath}: no \`api\` object to read routes from; the surface names a manifest that declares none`,
    )
  }
  return Object.entries(manifest.api).map(([id, value]) => {
    if (!isDeclaredRoute(value)) {
      throw new Error(
        `${manifestPath}: api entry \`${id}\` declares no string \`method\` and \`path\`; fix the manifest instead of leaving the route unpoliced`,
      )
    }
    return value
  })
}

const listSourceFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir)
  return entries
    .filter((entry) => entry.endsWith('.mts') || entry.endsWith('.html'))
    .map((entry) => `${dir}/${entry}`)
}

// Comment lines are dropped so a path mentioned in prose is not read as
// a call site.
const stripComments = (source: string): string =>
  source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return (
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('/*')
      )
    })
    .join('\n')

const extractPathLiterals = (source: string): string[] =>
  stripComments(source)
    .matchAll(/['"](?<path>\/[a-z][\w\-\/]*)['"]/gv)
    .map((match) => match.groups?.path ?? '')
    .toArray()

// Path-shaped template literals are swept wherever they are written,
// not just inside a call: a builder returning one of several templates
// puts them a function away from any verb, and they would otherwise be
// the only paths nothing checks.
const extractPathTemplates = (source: string): string[] =>
  stripComments(source)
    .matchAll(/`(?<template>\/[a-z][^`]*)`/gv)
    .map((match) => match.groups?.template ?? '')
    .toArray()

// The typed helpers carry the verb in their name; the boot beacon calls
// the raw SDK with the verb as its first argument. Reading the pair
// matters because a surface may declare one path under several
// methods, so a path alone cannot identify its route. The
// helper name must be followed immediately by its generic or its paren,
// so the import list is not read as a call site. Template-built paths
// are swept separately below; a path passed as a variable stays out of
// scope, exactly as for the bare-path sweep above.
const HELPER_CALL =
  /homeyApi(?<verb>Get|Put|Post|Delete)(?:<[^\(\)]*>)?\(\s*[\w.#]+\s*,\s*['"](?<path>\/[a-z][\w\-\/]*)['"]/gv
const SDK_CALL =
  /homey\.api\(\s*['"](?<verb>[A-Z]+)['"]\s*,\s*['"](?<path>\/[a-z][\w\-\/]*)['"]/gv

const extractRouteCalls = (source: string): DeclaredRoute[] => {
  const stripped = stripComments(source)
  return [
    ...stripped
      .matchAll(HELPER_CALL)
      .map((match) => ({
        method: (match.groups?.verb ?? '').toUpperCase(),
        path: match.groups?.path ?? '',
      })),
    ...stripped
      .matchAll(SDK_CALL)
      .map((match) => ({
        method: match.groups?.verb ?? '',
        path: match.groups?.path ?? '',
      })),
  ]
}

// A call site may build its path from a template, which the literal
// sweeps above cannot see — left alone, such verbs would go
// unchecked. A template is still partly known
// at build time: its literal chunks are fixed and ordered, and only the
// `${…}` holes float (one may expand to nothing, as an optional query
// string does). Keeping the chunks and letting the holes float is enough
// to require that some declared route of the same method could serve the
// call, which is the pair check's whole point.
const HELPER_TEMPLATE_CALL =
  /homeyApi(?<verb>Get|Put|Post|Delete)(?:<[^\(\)]*>)?\(\s*[\w.#]+\s*,\s*`(?<template>[^`]*)`/gv

const escapeRegExp = (chunk: string): string =>
  chunk.replaceAll(/[$\(\)*+.?\[\\\]^\{\|\}]/gv, String.raw`\$&`)

// A hole can nest braces — `${new URLSearchParams({ … })}` does — so the
// literal chunks are found by tracking depth, not by a regex that would
// stop at the first inner `}`. `${` is folded to one sentinel first so
// the scan reads a single character per step.
const NOT_FOUND = -1

const HOLE = '\u{1}'

interface TemplateScan {
  readonly chunks: string[]
  depth: number
  literal: string
}

const scanTemplateChar = (scan: TemplateScan, char: string): void => {
  if (char === HOLE) {
    if (scan.depth === 0) {
      scan.chunks.push(scan.literal)
      scan.literal = ''
    }
    scan.depth += 1
  } else if (char === '{' && scan.depth > 0) {
    scan.depth += 1
  } else if (char === '}' && scan.depth > 0) {
    scan.depth -= 1
  } else if (scan.depth === 0) {
    scan.literal += char
  }
}

const toTemplateChunks = (template: string): string[] => {
  const scan: TemplateScan = { chunks: [], depth: 0, literal: '' }
  for (const char of template.replaceAll('${', '\u{1}')) {
    scanTemplateChar(scan, char)
  }
  scan.chunks.push(scan.literal)
  return scan.chunks
}

// Declared paths carry no query string, so anything from the first `?`
// of a literal chunk on is dropped — a `?` inside a hole is part of the
// hole and never reaches here.
const toTemplatePattern = (template: string): RegExp => {
  const chunks = toTemplateChunks(template)
  const queryIndex = chunks.findIndex((chunk) => chunk.includes('?'))
  const pathChunks =
    queryIndex === NOT_FOUND
      ? chunks
      : [
          ...chunks.slice(0, queryIndex),
          (chunks[queryIndex] ?? '').split('?', 1)[0] ?? '',
        ]
  return new RegExp(
    `^${pathChunks.map((chunk) => escapeRegExp(chunk)).join('.*')}$`,
    'v',
  )
}

interface TemplateCall {
  readonly method: string
  readonly pattern: RegExp
  readonly template: string
}

const extractTemplateCalls = (source: string): TemplateCall[] =>
  stripComments(source)
    .matchAll(HELPER_TEMPLATE_CALL)
    .map((match) => ({
      method: (match.groups?.verb ?? '').toUpperCase(),
      pattern: toTemplatePattern(match.groups?.template ?? ''),
      template: match.groups?.template ?? '',
    }))
    .toArray()

// Counting every helper call site, whatever shape its path takes, turns
// the sweeps above from "found something" into "found everything": a
// call the extractors cannot read shows up as a shortfall instead of
// passing unseen. A generic may wrap across lines, so newlines are
// allowed inside it.
const HELPER_CALL_SITE = /homeyApi(?:Get|Put|Post|Delete)(?:<[^\(\)]*>)?\s*\(/gv

// Some call sites hand over a path the site itself does not spell: a
// parameter on a list helper, or a builder returning one of several
// templates. Their verb is unreadable there, but every path they can
// produce is written somewhere in the same sources, which the sweep
// below reads. Counting them keeps the accounting complete instead of
// letting them vanish.
const HELPER_INDIRECT_CALL =
  /homeyApi(?:Get|Put|Post|Delete)(?:<[^\(\)]*>)?\(\s*[\w.#]+\s*,\s*[a-z]\w*/gv

const countMatches = (source: string, pattern: RegExp): number =>
  stripComments(source).matchAll(pattern).toArray().length

const dedupeCalls = (calls: DeclaredRoute[]): DeclaredRoute[] => {
  const byPair = new Map<string, DeclaredRoute>()
  for (const call of calls) {
    byPair.set(`${call.method} ${call.path}`, call)
  }
  return byPair.values().toArray()
}

const routeMatches = (routePath: string, literal: string): boolean => {
  const routeSegments = routePath.split('/')
  const literalSegments = literal.split('/')
  return (
    routeSegments.length === literalSegments.length &&
    routeSegments.every(
      (segment, index) =>
        segment.startsWith(':') || segment === literalSegments[index],
    )
  )
}

const readSurfaceSources = async (
  sourceDirs: readonly string[],
): Promise<string[]> => {
  const fileGroups = await Promise.all(
    sourceDirs.map(async (dir) => listSourceFiles(dir)),
  )
  return Promise.all(
    fileGroups.flat().map(async (file) => readFile(file, 'utf8')),
  )
}

const collectUndeclaredPaths = (
  routes: readonly DeclaredRoute[],
  literals: readonly string[],
  templates: readonly string[],
): string[] => [
  ...[...new Set(literals)].filter((literal) =>
    routes.every((route) => !routeMatches(route.path, literal)),
  ),
  ...[...new Set(templates)].filter((template) => {
    const pattern = toTemplatePattern(template)
    return routes.every((route) => !pattern.test(route.path))
  }),
]

const collectUndeclaredMethodCalls = (
  routes: readonly DeclaredRoute[],
  calls: DeclaredRoute[],
): string[] =>
  dedupeCalls(calls)
    .filter((call) =>
      routes.every(
        (route) =>
          route.method !== call.method || !routeMatches(route.path, call.path),
      ),
    )
    .map(({ method, path }) => `${method} ${path}`)

const collectUndeclaredTemplateCalls = (
  routes: readonly DeclaredRoute[],
  templateCalls: readonly TemplateCall[],
): string[] =>
  templateCalls
    .filter((call) =>
      routes.every(
        (route) =>
          route.method !== call.method || !call.pattern.test(route.path),
      ),
    )
    .map(({ method, template }) => `${method} ${template}`)

const countAll = (sources: readonly string[], pattern: RegExp): number =>
  sources.reduce((total, source) => total + countMatches(source, pattern), 0)

/**
 * Reads one surface's manifest and sources and returns every finding
 * the generated suite asserts on — empty arrays and a balanced
 * accounting mean the surface is clean.
 * @param surface - The manifest path, display name and source dirs.
 * @returns The undeclared calls and the call-site accounting.
 * @category Testing
 */
export const analyzeRouteGuards = async (
  surface: Surface,
): Promise<RouteGuardFindings> => {
  const routes = await readRoutes(surface.manifest)
  const sources = await readSurfaceSources(surface.sourceDirs)
  const calls = sources.flatMap((source) => extractRouteCalls(source))
  const templateCalls = sources.flatMap((source) =>
    extractTemplateCalls(source),
  )
  return {
    accountedCallSites: countAll(sources, HELPER_CALL_SITE),
    parsedOrIndirectCalls:
      calls.length +
      templateCalls.length +
      countAll(sources, HELPER_INDIRECT_CALL),
    undeclaredMethodCalls: collectUndeclaredMethodCalls(routes, calls),
    undeclaredPaths: collectUndeclaredPaths(
      routes,
      sources.flatMap((source) => extractPathLiterals(source)),
      sources.flatMap((source) => extractPathTemplates(source)),
    ),
    undeclaredTemplateCalls: collectUndeclaredTemplateCalls(
      routes,
      templateCalls,
    ),
  }
}
