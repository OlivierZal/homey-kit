import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// The Homey process workflows this package hosts since 6.1.0 — the
// apps' validate and publish paths, the link to the uploaded build and
// the iOS floor watch — are release-only or scheduled, so what a static
// read can hold is the shape the callers depend on: the call surface,
// the environment and the grants the jobs claim, and the injection
// posture of the scripts that read inputs or a token. A rename or a
// dropped grant fails here rather than at three apps' next release. The
// one script that decides something, the build link's, is run as well:
// against a job listing and a log as the API answers them, with a
// stand-in for `curl`.

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

const linkStep = (): Record<string, unknown> =>
  asRecord(
    stepsOf('reusable-homey-build-link.yml', 'build-link').find(
      ({ id }) => id === 'link',
    ),
    'the link step',
  )

const linkScript = (): string => {
  const { run } = linkStep()
  if (typeof run !== 'string') {
    throw new TypeError('the link step has no script')
  }
  return run
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

describe('reusable-homey-build-link.yml', () => {
  it('should be callable without inputs and answer the page it read', () => {
    const call = asRecord(
      asRecord(workflow('reusable-homey-build-link.yml').on, 'on')
        .workflow_call,
      'workflow_call',
    )

    expect(new Set(Object.keys(call))).toStrictEqual(new Set(['outputs']))
    expect(
      new Set(Object.keys(asRecord(call.outputs, 'outputs'))),
    ).toStrictEqual(new Set(['url']))
  })

  it("should claim the one grant reading a job's log takes", () => {
    expect(
      jobOf('reusable-homey-build-link.yml', 'build-link').permissions,
    ).toStrictEqual({ actions: 'read' })
  })

  // The token reaches the script through the environment, never
  // interpolated into it, and the job it looks for is the publish
  // workflow's own, by the name that workflow gives it.
  it('should read the publish job by its name, with the token from the environment', () => {
    const { env: stepEnv, run } = linkStep()
    const env = asRecord(stepEnv, 'link env')

    expect(new Set(Object.keys(env))).toStrictEqual(
      new Set(['GH_TOKEN', 'PUBLISH_JOB']),
    )
    expect(env.GH_TOKEN).toMatch(/^\$\{\{ github\.token \}\}$/v)
    expect(env.PUBLISH_JOB).toBe(
      jobOf('reusable-homey-publish.yml', 'publish').name,
    )
    expect(run).not.toMatch(/\$\{\{/v)
  })
})

// The link step's script, run as the runner runs a `shell: bash` step,
// against a stand-in for `curl` that answers the two requests the
// script makes, for this run's attempt and for the publish job's id,
// and nothing else, or fails without a word as `--fail` does on a
// refusal. The listing names its jobs as a run does that calls
// the two reusables, and the log lines are a release's own (homey
// 4.6.3, 2026-11-21), the app's id apart.
describe('the link step of reusable-homey-build-link.yml', () => {
  const BUILD_PAGE =
    'https://tools.developer.homey.app/apps/app/com.example.app/build/360'
  const PUBLISH_JOB = 'Publish app on Homey'
  const JOBS = {
    jobs: [
      { id: 42, name: `publish / ${PUBLISH_JOB}` },
      { id: 43, name: 'build-link / Link the uploaded build' },
    ],
  }
  const UPLOADED =
    '2026-11-21T23:21:31.0094861Z ✓ App com.example.app@1.2.3 successfully uploaded.'
  const NAMED = `2026-11-21T23:21:31.0095646Z Visit ${BUILD_PAGE} to publish your app.`

  const sandbox = { directory: '' }

  const link = ({
    jobs = JOBS,
    log,
    status = 0,
  }: {
    readonly log: readonly string[]
    readonly jobs?: typeof JOBS
    readonly status?: number
  }): {
    readonly output: string
    readonly status: number | null
    readonly summary: string
  } => {
    const outputPath = path.join(sandbox.directory, 'output')
    const summaryPath = path.join(sandbox.directory, 'summary')
    writeFileSync(outputPath, '')
    writeFileSync(summaryPath, '')
    const { status: exitStatus } = spawnSync(
      'bash',
      ['--noprofile', '--norc', '-eo', 'pipefail', '-c', linkScript()],
      {
        cwd: sandbox.directory,
        env: {
          CURL_STATUS: String(status),
          GH_TOKEN: 'token',
          GITHUB_API_URL: 'https://api.github.test',
          GITHUB_OUTPUT: outputPath,
          GITHUB_REPOSITORY: 'owner/app',
          GITHUB_RUN_ATTEMPT: '2',
          GITHUB_RUN_ID: '7',
          GITHUB_STEP_SUMMARY: summaryPath,
          JOB_LOG: log.join('\n'),
          JOBS_JSON: JSON.stringify(jobs),
          PATH: [sandbox.directory, process.env.PATH].join(path.delimiter),
          PUBLISH_JOB,
        },
      },
    )
    return {
      output: readFileSync(outputPath, 'utf8'),
      status: exitStatus,
      summary: readFileSync(summaryPath, 'utf8'),
    }
  }

  beforeEach(() => {
    sandbox.directory = mkdtempSync(path.join(tmpdir(), 'homey-build-link-'))
    const curl = path.join(sandbox.directory, 'curl')
    writeFileSync(
      curl,
      [
        '#!/bin/sh',
        '[ "$CURL_STATUS" = 0 ] || exit "$CURL_STATUS"',
        'for url; do :; done',
        'case "$url" in',
        String.raw`  */owner/app/actions/runs/7/attempts/2/jobs\?per_page=100)`,
        String.raw`    printf '%s\n' "$JOBS_JSON" ;;`,
        '  */owner/app/actions/jobs/42/logs)',
        String.raw`    printf '%s\n' "$JOB_LOG" ;;`,
        'esac',
        '',
      ].join('\n'),
    )
    chmodSync(curl, 0o755)
  })

  afterEach(() => {
    rmSync(sandbox.directory, { force: true, recursive: true })
  })

  it('should answer and print the page of the build the log names', () => {
    expect(link({ log: [UPLOADED, NAMED] })).toStrictEqual({
      output: `url=${BUILD_PAGE}\n`,
      status: 0,
      summary: `Publish the uploaded build at ${BUILD_PAGE}\n`,
    })
  })

  // An upload that went through is never failed behind: whatever keeps
  // the page from being read leaves an empty answer and a green job.
  it.each([
    { label: 'the log names no build', options: { log: [UPLOADED] } },
    {
      label: 'the run holds no publish job',
      options: {
        jobs: { jobs: [{ id: 42, name: 'validate / Validate app' }] },
        log: [UPLOADED, NAMED],
      },
    },
    {
      label: 'the API refuses',
      options: { log: [UPLOADED, NAMED], status: 22 },
    },
  ])('should answer no page and still pass when $label', ({ options }) => {
    expect(link(options)).toStrictEqual({
      output: 'url=\n',
      status: 0,
      summary: '',
    })
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

describe('the install step of the Homey reusables', () => {
  // `$/` resolves in THIS repository at the running commit; `./` would
  // resolve in the caller's checkout, which is what made every app carry
  // a copy of the composite action before 6.2.0.
  it.each([
    ['reusable-homey-validate.yml', 'validate'],
    ['reusable-homey-publish.yml', 'publish'],
  ])(
    '%s should reach the composite action through the self-repository reference',
    (file, id) => {
      const install = stepsOf(file, id).find(
        ({ uses }) =>
          typeof uses === 'string' && uses.endsWith('setup-node-and-install'),
      )

      expect(install?.uses).toBe('$/.github/actions/setup-node-and-install')
    },
  )
})
