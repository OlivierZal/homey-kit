// The declaration half of the family's API contract, single-sourced:
// what each surface exposes against what its manifest declares. Each app
// supplies its surfaces (and its handler union as the type parameter);
// `findContractBreach` exposes the comparison for direct assertion (the
// seam this package's own mutation tests use). The call-site half lives
// in `analyzeRouteGuards`.
/**
 * One API surface under contract: its exposed handlers, its manifest
 * declaration and a display name for the failure output.
 * @template THandler - The app's handler union.
 * @category Testing
 */
export interface ContractSurface<THandler> {
  readonly api: Record<string, THandler>
  readonly config: { readonly api: Record<string, unknown> }
  readonly name: string
}

const sortedKeys = (object: object): string[] =>
  Object.keys(object).toSorted((left, right) => left.localeCompare(right))

/**
 * Compares a surface's exposed handlers against its manifest ids.
 * @param surface - The handler object, manifest and display name.
 * @returns The two sorted key lists when they diverge, `null` when the
 * surface is clean.
 * @category Testing
 */
export const findContractBreach = (
  surface: ContractSurface<unknown>,
): { readonly declared: string[]; readonly exposed: string[] } | null => {
  const declared = sortedKeys(surface.config.api)
  const exposed = sortedKeys(surface.api)
  return declared.join('\n') === exposed.join('\n')
    ? null
    : { declared, exposed }
}
