/**
 * The webview-side primitives every page shares: the boot cycle, the
 * dirty gate and the stale-cache self-heal.
 * @packageDocumentation
 */
export {
  type ReadyHost,
  type RunWebviewOptions,
  fireAndForget,
  runWebview,
  surfaceError,
  trySetDocumentLanguage,
  withInitTimeout,
} from './boot.ts'
export {
  type DirtyGate,
  type DirtyGateOptions,
  createDirtyGate,
} from './dirty-gate.ts'
export {
  type WatchWebviewFreshnessOptions,
  ensureFreshWebview,
  getPageIdentity,
  watchWebviewFreshness,
} from './webview-freshness.ts'
