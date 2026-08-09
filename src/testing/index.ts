/**
 * The analysis seams behind the family's table-driven API tests: each
 * app supplies its surface tables and its own `describe`/`it` blocks —
 * a test file that declares no test reads as empty to every analyzer —
 * while the comparisons stay single-sourced here.
 * @packageDocumentation
 */
export { type ContractSurface, findContractBreach } from './api-contract.ts'
export {
  type DeclaredRoute,
  type RouteGuardFindings,
  type Surface,
  analyzeRouteGuards,
} from './api-route-guards.ts'
