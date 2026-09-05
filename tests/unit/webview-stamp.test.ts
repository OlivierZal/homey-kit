import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  type WebviewPage,
  stampHtml,
  stampPackagedPages,
  stampReferences,
} from '../../src/node/webview-stamp.ts'

// One temp packaging tree per test, so a stamped page never leaks into
// the next; boxed because the hooks refill it.
const tree = { outRoot: '' }

const PAGES: readonly WebviewPage[] = [
  { entry: 'settings', page: 'settings/index.html' },
  { entry: 'charts', page: 'widgets/charts/public/index.html' },
]

const writePage = async (
  page: string,
  html: string,
  assets: Readonly<Record<string, string>> = {},
): Promise<string> => {
  const htmlPath = path.join(tree.outRoot, page)
  const directory = path.dirname(htmlPath)
  await mkdir(directory, { recursive: true })
  await writeFile(htmlPath, html)
  await Promise.all(
    Object.entries(assets).map(async ([file, content]) => {
      const assetPath = path.join(directory, file)
      await mkdir(path.dirname(assetPath), { recursive: true })
      await writeFile(assetPath, content)
    }),
  )
  return htmlPath
}

const readPage = async (htmlPath: string): Promise<string> =>
  readFile(htmlPath, 'utf8')

// The stamp contract, restated independently of the producer: the first
// eight hex digits of the asset's SHA-256.
const hashOf = (content: string): string =>
  createHash('sha256').update(content).digest('hex').slice(0, 8)

const stampsOf = (html: string): string[] =>
  html
    .matchAll(/\?v=(?<hash>[0-9a-f]+)/gv)
    .map(({ groups }) => groups?.hash ?? '')
    .toArray()

describe('webview stamping', () => {
  beforeEach(async () => {
    tree.outRoot = await mkdtemp(path.join(tmpdir(), 'homey-kit-stamp-'))
  })

  afterEach(async () => {
    await rm(tree.outRoot, { force: true, recursive: true })
  })

  it('should stamp every local reference with its content hash', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<link href="index.css" rel="stylesheet"><script defer src="index.js"></script>',
      { 'index.css': 'body{}', 'index.js': 'console.log(1)' },
    )

    const identity = await stampHtml(htmlPath)
    const html = await readPage(htmlPath)
    const stamps = stampsOf(html)

    expect(stamps).toHaveLength(2)
    expect(identity).toBe(stamps.join('.'))
  })

  it('should join the identity over unique hashes, as the page does', async () => {
    // Two DIFFERENT files with identical bytes carry the same stamp: the
    // page joins a Set of stamp VALUES, so counting both here would mint
    // an identity no page could ever match — an endless refetch.
    const htmlPath = await writePage(
      'settings/index.html',
      '<link href="a.css" rel="stylesheet"><link href="b.css" rel="stylesheet"><script defer src="index.js"></script>',
      { 'a.css': 'body{}', 'b.css': 'body{}', 'index.js': 'console.log(1)' },
    )

    const identity = await stampHtml(htmlPath)
    const stamps = stampsOf(await readPage(htmlPath))

    // Three references, two distinct hashes.
    expect(stamps).toHaveLength(3)
    expect(identity).toBe([...new Set(stamps)].join('.'))
  })

  it('should move the identity when any asset changes', async () => {
    const html =
      '<link href="index.css" rel="stylesheet"><script defer src="index.js"></script>'
    const first = await writePage('settings/index.html', html, {
      'index.css': 'body{}',
      'index.js': 'console.log(1)',
    })
    const before = await stampHtml(first)
    const second = await writePage('widgets/charts/public/index.html', html, {
      // A CSS-only ship still moves the page identity.
      'index.css': 'body{color:red}',
      'index.js': 'console.log(1)',
    })

    const after = await stampHtml(second)

    expect(after).not.toBe(before)
  })

  it('should re-stamp a page that already carries stamps', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<script defer src="index.js?v=deadbeef"></script>',
      { 'index.js': 'console.log(1)' },
    )

    await stampHtml(htmlPath)

    expect(stampsOf(await readPage(htmlPath))).not.toContain('deadbeef')
  })

  it('should stamp only inside a reference context', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<!-- index.js is the bundle --><script defer src="index.js"></script>',
      { 'index.js': 'console.log(1)' },
    )

    await stampHtml(htmlPath)
    const html = await readPage(htmlPath)

    expect(html).toContain('<!-- index.js is the bundle -->')
    expect(stampsOf(html)).toHaveLength(1)
  })

  it('should stamp a tag Prettier exploded over several lines', async () => {
    // Prettier owns the page's shape and breaks a tag past the print
    // width into one attribute per line. A pattern scoped to a tag or to
    // a single line would still stamp the inline form and silently miss
    // this one, so both shapes share a page here.
    const htmlPath = await writePage(
      'settings/index.html',
      `<link href="index.css" rel="stylesheet" />
<script
  data-testid="a-tag-past-the-print-width-that-prettier-explodes"
  defer
  src="index.js"
></script>`,
      { 'index.css': 'body{}', 'index.js': 'console.log(1)' },
    )

    const identity = await stampHtml(htmlPath)

    expect(stampsOf(await readPage(htmlPath))).toHaveLength(2)
    expect(identity).not.toBeNull()
  })

  it('should leave remote and rooted references alone', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<link href="https://cdn.invalid/x.css" rel="stylesheet"><img src="/logo.png" alt=""><script defer src="index.js"></script>',
      { 'index.js': 'console.log(1)' },
    )

    await stampHtml(htmlPath)
    const html = await readPage(htmlPath)

    expect(html).toContain('href="https://cdn.invalid/x.css"')
    expect(html).toContain('src="/logo.png"')
    expect(stampsOf(html)).toHaveLength(1)
  })

  it('should stamp an unknown file blank rather than drop it', () => {
    // A reference whose asset never hashed keeps its shape, so the page
    // still loads and its identity simply cannot match — the handshake's
    // fail-open side.
    expect(stampReferences('<script src="ghost.js"></script>', new Map())).toBe(
      '<script src="ghost.js?v="></script>',
    )
  })

  it('should report no identity for an unstamped page', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<p>Nothing to stamp</p>',
    )

    await expect(stampHtml(htmlPath)).resolves.toBeNull()
  })

  it('should report no identity for an absent page copy', async () => {
    await expect(
      stampHtml(path.join(tree.outRoot, 'settings/index.html')),
    ).resolves.toBeNull()
  })

  it('should fail on a page copy that exists but cannot be read', async () => {
    // Only absence means "nothing to stamp": a directory where the page
    // should be is a broken packaging tree, not a standalone run.
    await expect(stampHtml(tree.outRoot)).rejects.toThrow('EISDIR')
  })

  it('should emit the manifest once every page is stamped', async () => {
    await Promise.all(
      PAGES.map(async ({ page }) =>
        writePage(page, '<script defer src="index.js"></script>', {
          'index.js': `console.log('${page}')`,
        }),
      ),
    )

    // The oracle is the hash itself, computed here rather than read back
    // through the unit under test: each page carries one asset, so its
    // identity is that asset's hash, keyed by entry in declaration order.
    const expected = Object.fromEntries(
      PAGES.map(({ entry, page }) => [entry, hashOf(`console.log('${page}')`)]),
    )

    await expect(stampPackagedPages(tree.outRoot, PAGES)).resolves.toBe(true)

    await expect(
      readFile(path.join(tree.outRoot, 'webview-hashes.json'), 'utf8'),
    ).resolves.toBe(JSON.stringify(expected))
  })

  it('should write no manifest outside the CLI flow', async () => {
    // No page copy exists: a standalone suite run has nothing to stamp
    // and must not leave a manifest behind.
    await expect(stampPackagedPages(tree.outRoot, PAGES)).resolves.toBe(false)
    await expect(
      readFile(path.join(tree.outRoot, 'webview-hashes.json'), 'utf8'),
    ).rejects.toThrow('ENOENT')
  })

  it('should fail the packaging pass on a partial tree, naming the missing pages', async () => {
    // One copy of two: a mistyped page path in the CLI flow, which must
    // not ship as a release with no manifest.
    await writePage(
      PAGES[0]?.page ?? '',
      '<script defer src="index.js"></script>',
      { 'index.js': 'console.log(1)' },
    )

    await expect(stampPackagedPages(tree.outRoot, PAGES)).rejects.toThrow(
      'Packaged page copies are missing for: charts',
    )
    await expect(
      readFile(path.join(tree.outRoot, 'webview-hashes.json'), 'utf8'),
    ).rejects.toThrow('ENOENT')
  })

  it('should fail the packaging pass on a reference to a missing asset', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<script defer src="ghost.js"></script>',
    )

    await expect(stampHtml(htmlPath)).rejects.toThrow('ENOENT')
  })
})
