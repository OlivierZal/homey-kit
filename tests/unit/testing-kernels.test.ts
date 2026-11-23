import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  analyzeRouteGuards,
  findContractBreach,
  findLocaleDrift,
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

  // The generated files hold their texts in another order than their
  // sources, beside a file that is no locale: neither is drift.
  it('should read generated locales as what their sources declare', async () => {
    await expect(
      findLocaleDrift(fixturePath('locales-clean')),
    ).resolves.toStrictEqual([])
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
      /* eslint-disable-next-line no-template-curly-in-string -- the finding
         names the template verbatim */
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
      /* eslint-disable-next-line no-template-curly-in-string -- the finding
         names the template verbatim */
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

describe('locale drift', () => {
  // The mutation seam, one language per way a generated file leaves
  // its source: `da` outlived its source, `en` holds an earlier
  // wording, a text its source dropped and lacks a text its source
  // gained, `fr` was never generated, and `sv` is clean.
  it('should name every text a generated file and its source disagree on', async () => {
    await expect(
      findLocaleDrift(fixturePath('locales-drifted')),
    ).resolves.toStrictEqual([
      {
        differing: [],
        generatedOnly: ['settings.title'],
        language: 'da',
        sourceOnly: [],
      },
      {
        differing: ['settings.title'],
        generatedOnly: ['settings.legacy'],
        language: 'en',
        sourceOnly: ['log.reverted'],
      },
      {
        differing: [],
        generatedOnly: [],
        language: 'fr',
        sourceOnly: ['settings.title'],
      },
    ])
  })

  // A comparison of nothing would pass: an app directory without a
  // locale source is a wrong directory, not a clean app.
  it('should throw on an app that declares no locale source', async () => {
    await expect(
      findLocaleDrift(fixturePath('locales-unsourced')),
    ).rejects.toThrow(/no locale source to compare/v)
  })
})
