/**
 * The node-side halves of the freshness handshake: the package-time
 * stamp producer (content-hash `?v=` stamps plus the
 * `webview-hashes.json` manifest) and the runtime reader the
 * `GET /webview-hashes` route serves.
 * @packageDocumentation
 */
export { getWebviewHashes } from './webview-hashes.ts'
export {
  type WebviewPage,
  stampHtml,
  stampPackagedPages,
  stampReferences,
} from './webview-stamp.ts'
