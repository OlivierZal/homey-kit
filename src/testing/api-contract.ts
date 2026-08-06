// The declaration half of the family's API contract, single-sourced:
// what each surface exposes against what its manifest declares. Each app
// supplies its surfaces (and its handler union as the type parameter);
// `findContractBreach` exposes the comparison for direct assertion (the
// seam this package's own mutation tests use). The call-site half lives
// in `createRouteGuardSuite`.
import { describe, expect, it } from 'vitest'

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

/**
 * Generates the family's contract suite over the caller's surfaces.
 * @param surfaces - One entry per API surface the app ships.
 */
export const createApiContractSuite = <THandler extends CallableFunction>(
  surfaces: readonly ContractSurface<THandler>[],
): void => {
  // The type half lives in the signature: the caller's
  // `createApiContractSuite<Handler>` line only compiles when the whole
  // handler union is callable — no per-name method reference ever
  // leaves its object (unbound-method).
  describe('api contract', () => {
    // One equality per surface pins the ids ↔ handlers mapping in both
    // directions at once: a handler with no declaration and a
    // declaration with no handler both break it, and the diff names the
    // offender.
    it.each(surfaces)(
      '$name should declare exactly the handlers its manifest names',
      (surface) => {
        expect(findContractBreach(surface)).toBeNull()
      },
    )
  })
}
