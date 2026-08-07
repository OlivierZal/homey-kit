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

/**
 * Reads the packaged manifest; outside the packaged flow (dev suite
 * runs) it is absent and the empty map means every page treats itself
 * as fresh.
 *
 * The manifest location is APP knowledge: it sits where the app's own
 * bundler stamped it, which no path relative to this module can reach.
 * It is required for that reason — an inferred default resolves inside
 * `node_modules` and fails open, disabling the freshness handshake with
 * no symptom. Nothing is memoised either: a module whose purpose is
 * defeating stale caches must not hold one.
 * @param manifestUrl - Where the app's bundler emitted `webview-hashes.json`, usually `new URL('../webview-hashes.json', import.meta.url)` from the app root.
 * @returns The page-entry → live-identity map.
 * @category Node
 */
export const getWebviewHashes = async (
  manifestUrl: URL,
): Promise<Partial<Record<string, string>>> => loadWebviewHashes(manifestUrl)
