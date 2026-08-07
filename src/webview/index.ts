/**
 * The webview-side primitives every gated page shares: the dirty gate
 * and the stale-cache self-heal.
 * @packageDocumentation
 */
export {
  type DirtyGate,
  type DirtyGateOptions,
  createDirtyGate,
} from './dirty-gate.ts'
export { ensureFreshWebview, getPageIdentity } from './webview-freshness.ts'
