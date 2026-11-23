/**
 * The analysis seams behind the family's table-driven API tests and
 * its locale test — each app supplies its surface tables, its
 * directory and its own `describe`/`it` blocks (a test file that
 * declares no test reads as empty to every analyzer) while the
 * comparisons stay single-sourced here — plus the plain test helpers
 * every consuming suite shares.
 * @packageDocumentation
 */
export { type ContractSurface, findContractBreach } from './api-contract.ts'
export {
  type DeclaredRoute,
  type RouteGuardFindings,
  type Surface,
  analyzeRouteGuards,
} from './api-route-guards.ts'
export {
  type InteropModule,
  type RecordedCalls,
  assertDefined,
  getMockCallArg,
  mock,
  settleDetached,
} from './helpers.ts'
export { type LocaleDrift, findLocaleDrift } from './locales.ts'
