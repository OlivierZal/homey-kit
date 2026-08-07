import { describe, expect, it } from 'vitest'

import { getWebviewHashes } from '../../src/node/webview-hashes.ts'

const fixture = (name: string): URL =>
  new URL(`../fixtures/webview-hashes/${name}`, import.meta.url)

describe(getWebviewHashes, () => {
  it('should serve an empty map when no manifest is packaged', async () => {
    // Outside the packaged flow the manifest is absent, and the empty
    // map means every page treats itself as fresh.
    await expect(
      getWebviewHashes(fixture('absent.json')),
    ).resolves.toStrictEqual({})
  })

  it('should serve the packaged manifest', async () => {
    await expect(
      getWebviewHashes(fixture('valid.json')),
    ).resolves.toStrictEqual({
      'page-a': 'aaaa1111',
      'page-b': 'bbbb2222',
      'page-c': 'cccc3333',
    })
  })

  it('should serve an empty map for a malformed manifest', async () => {
    await expect(
      getWebviewHashes(fixture('malformed.txt')),
    ).resolves.toStrictEqual({})
  })

  it('should serve an empty map for an off-shape manifest', async () => {
    await expect(
      getWebviewHashes(fixture('offshape.json')),
    ).resolves.toStrictEqual({})
  })
})
