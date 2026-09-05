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

import { namedGroup } from '../testing/named-group.ts'

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
 * commented reference today; delete, never comment out.
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

/**
 * Stamps one packaged page in place and returns the identity it now
 * carries.
 * @param htmlPath - The packaged page copy.
 * @returns The page identity, or `null` when there is nothing to stamp.
 * @category Node
 */
export const stampHtml = async (htmlPath: string): Promise<string | null> => {
  let html: string
  try {
    html = await readFile(htmlPath, 'utf8')
  } catch {
    // The page copy only exists in the CLI flow; a standalone suite run
    // has nothing to stamp.
    return null
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
  return identity === '' ? null : identity
}

/**
 * Stamps every packaged page and emits the live-hash manifest the app
 * serves (`GET /webview-hashes`) — only in the CLI flow, where every
 * page copy exists: a standalone suite run stamps nothing and must not
 * leave a partial manifest.
 * @param outRoot - The packaging target directory.
 * @param pages - The packaged pages and their manifest keys.
 * @returns Whether the manifest was written.
 * @category Node
 */
export const stampPackagedPages = async (
  outRoot: string,
  pages: readonly WebviewPage[],
): Promise<boolean> => {
  const stampedEntries = await Promise.all(
    pages.map(async ({ entry, page }): Promise<[string, string | null]> => [
      entry,
      await stampHtml(path.join(outRoot, page)),
    ]),
  )
  if (stampedEntries.some(([, hash]) => hash === null)) {
    return false
  }
  await writeFile(
    path.join(outRoot, 'webview-hashes.json'),
    JSON.stringify(Object.fromEntries(stampedEntries)),
  )
  return true
}
