/**
 * Package-time producer of the freshness handshake's identities:
 * stamps every local asset reference of the packaged pages with a
 * content hash (`?v=`) and emits the `webview-hashes.json` manifest the
 * app serves (`GET /webview-hashes`), which `getWebviewHashes` reads
 * back at runtime. Phone webviews cache assets across app versions, so
 * a content hash per file forces a refetch exactly when a file changes,
 * and the join of a page's stamps is the identity its own freshness
 * handshake compares against. The committed source HTML stays
 * unstamped — this is a package-time transform of the packaging copy,
 * which exists in the Homey CLI flow (its pre-process copy runs before
 * `npm run build`) and is absent in a standalone suite run, which only
 * proves the bundles compile.
 * @packageDocumentation
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { namedGroup } from '../named-group.ts'

const HASH_LENGTH = 8

// A local asset reference — an href/src attribute value, with an
// optional existing stamp.
const REFERENCE =
  /(?<prefix>href="|src=")(?<file>[^"':?\/][^"':?]*)(?:\?v=[0-9a-f]+)?(?<suffix>")/gv

// A reference's parts, plus where the match sits so the rewrite can
// splice it back byte-exactly.
interface Reference {
  readonly file: string
  readonly index: number
  readonly length: number
  readonly prefix: string
  readonly suffix: string
}

/**
 * One packaged page and the manifest key its bundle hash is served
 * under.
 * @category Node
 */
export interface WebviewPage {
  readonly entry: string
  readonly page: string
}

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT'

const hashOf = async (filePath: string): Promise<string> => {
  const content = await readFile(filePath)
  return createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, HASH_LENGTH)
}

// One parse for both passes; every alternative of `REFERENCE` binds all
// three named groups, and the throwing reader keeps that guarantee in
// one place instead of a fallback no match can reach.
const collectReferences = (html: string): Reference[] =>
  html
    .matchAll(REFERENCE)
    .map((match) => ({
      file: namedGroup(match, 'file'),
      index: match.index,
      length: match[0].length,
      prefix: namedGroup(match, 'prefix'),
      suffix: namedGroup(match, 'suffix'),
    }))
    .toArray()

const hashEntry = async (
  directory: string,
  file: string,
): Promise<[string, string]> => [file, await hashOf(path.join(directory, file))]

// Each unique file is hashed once; the map's insertion order is the
// document order of first reference, which the identity join reads.
const collectHashes = async (
  html: string,
  directory: string,
): Promise<ReadonlyMap<string, string>> => {
  const files = [...new Set(collectReferences(html).map(({ file }) => file))]
  const entries = await Promise.all(
    files.map(async (file) => hashEntry(directory, file)),
  )
  return new Map(entries)
}

/**
 * Stamps only within a reference context (`href="`/`src="`), so a bare
 * filename written elsewhere (e.g. prose in a comment) is never
 * rewritten. A FULL reference inside an HTML comment still matches:
 * pointing at a missing file it fails the packaging pass (ENOENT);
 * pointing at a real file it earns a stamp the page-side DOM query
 * never sees, splitting the builder identity from the page identity —
 * one refetch, then a boot-error on every open. No page carries a
 * commented reference today; delete, never comment out. A reference the
 * map has no hash for is stamped blank (`?v=`) rather than dropped: the
 * page collects only non-empty stamps and the identity joins only the
 * map's values, so neither side counts it.
 * @param html - The page to rewrite.
 * @param hashes - Content hash per referenced file.
 * @returns The page with every local reference stamped.
 * @category Node
 */
export const stampReferences = (
  html: string,
  hashes: ReadonlyMap<string, string>,
): string => {
  let stamped = ''
  let cursor = 0
  for (const { file, index, length, prefix, suffix } of collectReferences(
    html,
  )) {
    stamped += `${html.slice(cursor, index)}${prefix}${file}?v=${hashes.get(file) ?? ''}${suffix}`
    cursor = index + length
  }
  return stamped + html.slice(cursor)
}

// The page copy only exists in the CLI flow; a standalone suite run has
// nothing to stamp. Anything but its absence is a real failure:
// answering `null` to a permission error would ship a release with no
// manifest and a silently disabled handshake.
const readPageCopy = async (htmlPath: string): Promise<string | null> => {
  try {
    return await readFile(htmlPath, 'utf8')
  } catch (error) {
    if (isMissingFile(error)) {
      return null
    }
    throw error
  }
}

// What stamping one page copy found: no copy at all, a copy with no
// local reference to stamp, or the identity the stamped copy carries.
type PageStamp = 'absent' | 'unstamped' | { readonly identity: string }

const stampPage = async (htmlPath: string): Promise<PageStamp> => {
  const html = await readPageCopy(htmlPath)
  if (html === null) {
    return 'absent'
  }
  const hashes = await collectHashes(html, path.dirname(htmlPath))
  const stamped = stampReferences(html, hashes)
  if (stamped !== html) {
    await writeFile(htmlPath, stamped)
  }
  // The page's identity is the join of every stamp it carries, in
  // DOCUMENT order (the match order of `REFERENCE`, which the page's
  // own collection mirrors): a change to any packaged asset (bundle,
  // stylesheet) moves the identity, so CSS-only or markup-only ships
  // self-heal too. Deduplicated by HASH, exactly as the page does it
  // (`webview-freshness` joins a `Set` of stamp VALUES): two assets
  // with identical bytes carry one stamp on the page, so counting them
  // twice here would mint an identity no page can ever match — an
  // endless refetch handshake.
  const identity = [...new Set(hashes.values())].join('.')
  return identity === '' ? 'unstamped' : { identity }
}

/**
 * Stamps one packaged page in place and returns the identity it now
 * carries.
 * @param htmlPath - The packaged page copy.
 * @returns The page identity, or `null` when there is nothing to stamp — no copy, or a copy with no local reference.
 * @throws When the page copy exists but cannot be read — only its absence means "nothing to stamp".
 * @category Node
 */
export const stampHtml = async (htmlPath: string): Promise<string | null> => {
  const stamp = await stampPage(htmlPath)
  return typeof stamp === 'string' ? null : stamp.identity
}

type PageStamps = readonly (readonly [string, PageStamp])[]

// Sorts one tree's stamps into the three states, so each verdict reads
// its own list and no narrowing is left for a branch no input reaches.
const sortStamps = (
  stamps: PageStamps,
): {
  absent: string[]
  identities: [string, string][]
  unstamped: string[]
} => {
  const absent: string[] = []
  const identities: [string, string][] = []
  const unstamped: string[] = []
  for (const [entry, stamp] of stamps) {
    if (stamp === 'absent') {
      absent.push(entry)
    } else if (stamp === 'unstamped') {
      unstamped.push(entry)
    } else {
      identities.push([entry, stamp.identity])
    }
  }
  return { absent, identities, unstamped }
}

/**
 * Stamps every packaged page and emits the live-hash manifest the app
 * serves (`GET /webview-hashes`). Three trees, three answers: every
 * page copy present (the CLI flow) — stamped, manifest written, `true`;
 * none present (a standalone suite run, which has no packaging copy) —
 * nothing to do, `false`; SOME present — a mistyped page path in the
 * CLI flow, which must fail the packaging pass rather than ship a
 * release with no manifest and a silently disabled handshake. A copy
 * that carries no local reference fails the pass too, named apart from
 * a missing one: it would have no identity for its page to compare.
 * @param outRoot - The packaging target directory.
 * @param pages - The packaged pages and their manifest keys.
 * @returns Whether the manifest was written.
 * @throws When only some of the page copies exist, or a copy has nothing to stamp.
 * @category Node
 */
export const stampPackagedPages = async (
  outRoot: string,
  pages: readonly WebviewPage[],
): Promise<boolean> => {
  const stamps = await Promise.all(
    pages.map(
      async ({ entry, page }): Promise<readonly [string, PageStamp]> => [
        entry,
        await stampPage(path.join(outRoot, page)),
      ],
    ),
  )
  const { absent, identities, unstamped } = sortStamps(stamps)
  if (absent.length === stamps.length) {
    return false
  }
  if (absent.length > 0) {
    throw new Error(
      `Packaged page copies are missing for: ${absent.join(', ')}`,
    )
  }
  if (unstamped.length > 0) {
    throw new Error(
      `Packaged pages carry no local reference to stamp: ${unstamped.join(', ')}`,
    )
  }
  await writeFile(
    path.join(outRoot, 'webview-hashes.json'),
    JSON.stringify(Object.fromEntries(identities)),
  )
  return true
}
