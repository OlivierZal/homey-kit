import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// The three Homey process workflows this package hosts since 6.1.0 —
// the apps' validate and publish paths, and the iOS floor watch — are
// release-only or scheduled, so what a static read can hold is the
// shape the callers depend on: the call surface, the environment and
// the grants the jobs claim, and the injection posture of the one
// script that reads inputs. A rename or a dropped grant fails here
// rather than at three apps' next release.

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new TypeError(`${name} is not a mapping`)
  }
  return value
}

const workflow = (file: string): Record<string, unknown> =>
  asRecord(
    parse(
      readFileSync(path.join(REPO_ROOT, '.github/workflows', file), 'utf8'),
    ),
    file,
  )

const jobOf = (file: string, id: string): Record<string, unknown> =>
  asRecord(asRecord(workflow(file).jobs, `${file} jobs`)[id], `${file}#${id}`)

const stepsOf = (file: string, id: string): Record<string, unknown>[] => {
  const { steps } = jobOf(file, id)
  if (!Array.isArray(steps)) {
    throw new TypeError(`${file}#${id} has no steps`)
  }
  return steps.map((step) => asRecord(step, `${file}#${id} step`))
}

describe('reusable-homey-validate.yml', () => {
  it('should be callable without inputs', () => {
    expect(workflow('reusable-homey-validate.yml').on).toStrictEqual({
      workflow_call: {},
    })
  })

  it('should validate at publish level with the read grants only', () => {
    const validate = jobOf('reusable-homey-validate.yml', 'validate')
    const last = stepsOf('reusable-homey-validate.yml', 'validate').at(-1)

    expect(validate.permissions).toStrictEqual({
      contents: 'read',
      packages: 'read',
    })
    expect(last?.uses).toMatch(
      /^athombv\/github-action-homey-app-validate@[0-9a-f]{40}$/v,
    )
    expect(last?.with).toStrictEqual({ level: 'publish' })
  })
})

describe('reusable-homey-publish.yml', () => {
  it('should be callable with the bundle list and the stamped page', () => {
    const call = asRecord(
      asRecord(workflow('reusable-homey-publish.yml').on, 'on').workflow_call,
      'workflow_call',
    )
    const inputs = asRecord(call.inputs, 'inputs')
    const bundles = asRecord(inputs.bundles, 'bundles')
    const stampedPage = asRecord(inputs['stamped-page'], 'stamped-page')
    const secrets = asRecord(call.secrets, 'secrets')

    expect(new Set(Object.keys(inputs))).toStrictEqual(
      new Set(['bundles', 'stamped-page']),
    )
    expect(bundles.required).toBe(true)
    expect(bundles.type).toBe('string')
    expect(stampedPage.default).toBe('settings/index.html')
    expect(stampedPage.required).toBe(false)
    expect(new Set(Object.keys(secrets))).toStrictEqual(new Set(['HOMEY_PAT']))
    expect(asRecord(secrets.HOMEY_PAT, 'HOMEY_PAT').required).toBe(true)
  })

  it('should publish from the homey environment with the read grants only', () => {
    const publish = jobOf('reusable-homey-publish.yml', 'publish')

    expect(publish.environment).toBe('homey')
    expect(publish.permissions).toStrictEqual({
      contents: 'read',
      packages: 'read',
    })
  })

  // The inputs reach the assertion through the environment, never
  // interpolated into the script — the injection posture zizmor checks.
  it('should assert the bundles from the environment, not from the script', () => {
    const assertion = stepsOf('reusable-homey-publish.yml', 'publish').find(
      (step) => step.name === 'Assert the packaged bundles',
    )
    const env = asRecord(assertion?.env, 'assertion env')

    expect(env.BUNDLES).toMatch(/^\$\{\{ inputs\.bundles \}\}$/v)
    expect(env.STAMPED_PAGE).toMatch(/^\$\{\{ inputs\.stamped-page \}\}$/v)
    expect(assertion?.run).not.toMatch(/\$\{\{/v)
  })
})

describe('ios-floor-watch.yml', () => {
  // The watch opens its issue on the repository that runs it — this
  // one, where the webview-floor doctrine lives — with the one grant
  // that needs.
  it('should run monthly and on dispatch with the issues grant only', () => {
    const { on } = workflow('ios-floor-watch.yml')
    const watch = jobOf('ios-floor-watch.yml', 'watch')

    expect(new Set(Object.keys(asRecord(on, 'on')))).toStrictEqual(
      new Set(['schedule', 'workflow_dispatch']),
    )
    expect(watch.permissions).toStrictEqual({ issues: 'write' })
  })
})
