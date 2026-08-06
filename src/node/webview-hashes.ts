/**
 * Node-side reader of the packaged webview-hash manifest, emitted by
 * the consuming app's bundler at stamping time: `GET /webview-hashes`
 * serves it so a booted page can compare its own `?v=` identity and
 * refetch itself once when the phone webview cache served a stale copy.
 * @packageDocumentation
 */
import { readFile } from 'node:fs/promises'

const isStringRecord = (
  value: unknown,
): value is Partial<Record<string, string>> =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((entry) => typeof entry === 'string')

const parseManifest = (content: string): unknown => {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

const readManifest = async (manifestUrl: URL): Promise<string | null> => {
  try {
    return await readFile(manifestUrl, 'utf8')
  } catch {
    return null
  }
}

const loadWebviewHashes = async (
  manifestUrl: URL,
): Promise<Partial<Record<string, string>>> => {
  const content = await readManifest(manifestUrl)
  if (content === null) {
    return {}
  }
  const parsed = parseManifest(content)
  return isStringRecord(parsed) ? parsed : {}
}

const cache: { value: Promise<Partial<Record<string, string>>> | null } = {
  value: null,
}

/**
 * Reads the packaged manifest; outside the packaged flow (dev suite
 * runs) it is absent and the empty map means every page treats itself
 * as fresh.
 * @param manifestUrl - Test seam; the bare call the route handler makes reads (and caches) the manifest next to the app root.
 * @returns The page-entry → live-identity map.
 * @category Node
 */
export const getWebviewHashes = async (
  manifestUrl?: URL,
): Promise<Partial<Record<string, string>>> => {
  if (manifestUrl !== undefined) {
    return loadWebviewHashes(manifestUrl)
  }
  cache.value ??= loadWebviewHashes(
    new URL('../webview-hashes.json', import.meta.url),
  )
  return cache.value
}
