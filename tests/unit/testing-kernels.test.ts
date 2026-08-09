import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  analyzeRouteGuards,
  findContractBreach,
} from '../../src/testing/index.ts'

const fixturePath = (relative: string): string =>
  fileURLToPath(new URL(`../fixtures/kernel/${relative}`, import.meta.url))

const CLEAN_SURFACE = {
  manifest: fixturePath('manifest.json'),
  name: 'kernel fixture',
  sourceDirs: [fixturePath('sources')],
}

const CLEAN_CONTRACT_SURFACE = {
  api: { getThing: (): void => undefined, updateThing: (): void => undefined },
  config: {
    api: { getThing: { method: 'GET' }, updateThing: { method: 'PUT' } },
  },
  name: 'kernel fixture',
}

// The clean fixture asserted the way a consumer does — its own
// `describe`/`it` over the seams: green here means the kernels read a
// healthy surface as healthy, end to end.
describe('clean kernel fixture', () => {
  it('should account for every call site with nothing undeclared', async () => {
    const findings = await analyzeRouteGuards(CLEAN_SURFACE)

    expect(findings.undeclaredPaths).toStrictEqual([])
    expect(findings.undeclaredMethodCalls).toStrictEqual([])
    expect(findings.undeclaredTemplateCalls).toStrictEqual([])
    expect(findings.accountedCallSites).toBeGreaterThan(0)
    expect(findings.parsedOrIndirectCalls).toBeGreaterThanOrEqual(
      findings.accountedCallSites,
    )
  })

  it('should read the exposed handlers as matching their manifest', () => {
    expect(findContractBreach(CLEAN_CONTRACT_SURFACE)).toBeNull()
  })
})

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

  it('should throw on a manifest that declares no api object', async () => {
    await expect(
      analyzeRouteGuards({
        ...CLEAN_SURFACE,
        manifest: fixturePath('manifest-no-api.json'),
      }),
    ).rejects.toThrow(/no `api` object to read routes from/v)
  })

  // The mutation seam: a route removed from the manifest must surface
  // as a finding — this is what fails a consumer whose table and
  // sources drift apart.
  it('should report a call whose route the manifest does not declare', async () => {
    const findings = await analyzeRouteGuards({
      ...CLEAN_SURFACE,
      manifest: fixturePath('manifest-missing-route.json'),
    })

    expect(findings.undeclaredPaths).toStrictEqual([
      '/thing',
      // eslint-disable-next-line no-template-curly-in-string -- the finding names the template verbatim
      '/thing/${id}/tag',
    ])
    expect(findings.undeclaredMethodCalls).toStrictEqual([
      'GET /thing',
      'DELETE /thing',
    ])
  })

  it('should report a template call whose method the manifest does not declare', async () => {
    const findings = await analyzeRouteGuards({
      ...CLEAN_SURFACE,
      manifest: fixturePath('manifest-missing-route.json'),
    })

    expect(findings.undeclaredTemplateCalls).toStrictEqual([
      // eslint-disable-next-line no-template-curly-in-string -- the finding names the template verbatim
      'POST /thing/${id}/tag',
    ])
  })

  it('should keep the call-site accounting balanced on the fixture', async () => {
    const findings = await analyzeRouteGuards(CLEAN_SURFACE)

    expect(findings.accountedCallSites).toBe(6)
    expect(findings.parsedOrIndirectCalls).toBeGreaterThanOrEqual(6)
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
