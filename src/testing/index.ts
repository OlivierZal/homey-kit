/**
 * Table-driven test kernels, single-sourced: each app supplies its
 * surface tables and gets the family's API-contract and route-guard
 * suites generated over them.
 * @packageDocumentation
 */
export {
  type ContractSurface,
  createApiContractSuite,
  findContractBreach,
} from './api-contract.ts'
export {
  type DeclaredRoute,
  type RouteGuardFindings,
  type Surface,
  analyzeRouteGuards,
  createRouteGuardSuite,
} from './api-route-guards.ts'
