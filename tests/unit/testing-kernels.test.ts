import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  analyzeRouteGuards,
  createApiContractSuite,
  createRouteGuardSuite,
  findContractBreach,
} from '../../src/testing/index.ts'

const fixturePath = (relative: string): string =>
  fileURLToPath(new URL(`../fixtures/kernel/${relative}`, import.meta.url))

const CLEAN_SURFACE = {
  manifest: fixturePath('manifest.json'),
  name: 'kernel fixture',
  sourceDirs: [fixturePath('sources')],
}

// A handler union stand-in: the contract suite's type half asserts the
// union is callable.
type FixtureHandler = (() => void) | ((value: string) => number)

const CLEAN_CONTRACT_SURFACE = {
  api: { getThing: (): void => undefined, updateThing: (): void => undefined },
  config: {
    api: { getThing: { method: 'GET' }, updateThing: { method: 'PUT' } },
  },
  name: 'kernel fixture',
}

// The generated suites run against the clean fixture — green here means
// the factories wire the shared kernels end to end.
createRouteGuardSuite([CLEAN_SURFACE])
createApiContractSuite<FixtureHandler>([CLEAN_CONTRACT_SURFACE])

describe('route-guard findings', () => {
  // A malformed declaration must break the run, not shrink the route
  // set: dropping it would leave that route unpoliced under a green
  // suite, the one outcome this kernel exists to prevent.
  it('should throw on an api entry that is not a route', async () => {
    await expect(
      analyzeRouteGuards({
        ...CLEAN_SURFACE,
        manifest: fixturePath('manifest-malformed-route.json'),
      }),
    ).rejects.toThrow(/api entry `updateThing` declares no string/v)
  })

  // The mutation seam: a route removed from the manifest must surface
  // as a finding — this is what fails a consumer whose table and
  // sources drift apart.
  it('should report a call whose route the manifest does not declare', async () => {
    const findings = await analyzeRouteGuards({
      ...CLEAN_SURFACE,
      manifest: fixturePath('manifest-missing-route.json'),
    })

    expect(findings.undeclaredPaths).toStrictEqual(['/thing'])
    expect(findings.undeclaredMethodCalls).toStrictEqual(['GET /thing'])
  })

  it('should report a template call whose method the manifest does not declare', async () => {
    const findings = await analyzeRouteGuards({
      ...CLEAN_SURFACE,
      manifest: fixturePath('manifest-missing-route.json'),
    })

    expect(findings.undeclaredTemplateCalls).toStrictEqual([])
  })

  it('should keep the call-site accounting balanced on the fixture', async () => {
    const findings = await analyzeRouteGuards(CLEAN_SURFACE)

    expect(findings.accountedCallSites).toBe(2)
    expect(findings.parsedOrIndirectCalls).toBeGreaterThanOrEqual(2)
  })
})

describe('contract findings', () => {
  it('should report a handler the manifest does not declare', () => {
    const breach = findContractBreach({
      ...CLEAN_CONTRACT_SURFACE,
      api: {
        ...CLEAN_CONTRACT_SURFACE.api,
        orphanHandler: (): void => undefined,
      },
    })

    expect(breach).toStrictEqual({
      declared: ['getThing', 'updateThing'],
      exposed: ['getThing', 'orphanHandler', 'updateThing'],
    })
  })
})
