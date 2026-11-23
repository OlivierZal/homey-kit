import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
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

// The Homey process workflows this package hosts — the apps' validate
// and publish paths and the iOS floor watch since 6.1.0, the link to
// the uploaded build since 9.1.0 — are release-only or scheduled, so
// what a static read can hold is the shape the callers depend on: the
// call surface, the environment and the grants the jobs claim, and the
// injection posture of the bundle assertion and of the link step. A
// rename or a dropped grant fails here rather than at three apps' next
// release. One script is run as well, the link step's: against a
// stand-in for `curl` that answers a job listing and a log.

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

  // Nothing is uploaded before the commit is judged, and nothing
  // softens the verdict: the guard is the first command of the job,
  // right after the install its script is read from, and the step holds
  // an environment and that one call, with neither a condition nor a
  // tolerated failure. The script is configs' own, so the path is held
  // to the package this repository installs.
  it('should judge the commit before it uploads anything', () => {
    const steps = stepsOf('reusable-homey-publish.yml', 'publish')
    const index = steps.findIndex(({ run }) => run !== undefined)
    const guard = asRecord(steps[index], 'the guard step')
    const env = asRecord(guard.env, 'guard env')
    const script = 'node_modules/@olivierzal/configs/scripts/check-release.sh'

    expect(steps[index - 1]?.uses).toMatch(/\/setup-node-and-install$/v)
    expect(Object.keys(guard)).toStrictEqual(['env', 'run'])
    expect(guard.run).toBe(`bash ${script}`)
    expect(existsSync(path.join(REPO_ROOT, script))).toBe(true)
    expect(Object.keys(env)).toStrictEqual([
      'DEFAULT_BRANCH',
      'GITHUB_TOKEN',
      'HEAD_SHA',
      'IS_PRERELEASE',
      'THIS_REPO',
    ])
    expect(env.DEFAULT_BRANCH).toMatch(
      /^\$\{\{ github\.event\.repository\.default_branch \}\}$/v,
    )
    expect(env.GITHUB_TOKEN).toMatch(/^\$\{\{ secrets\.GITHUB_TOKEN \}\}$/v)
    expect(env.HEAD_SHA).toMatch(/^\$\{\{ github\.sha \}\}$/v)
    expect(env.IS_PRERELEASE).toMatch(
      /^\$\{\{ github\.event\.release\.prerelease \}\}$/v,
    )
    expect(env.THIS_REPO).toMatch(/^\$\{\{ github\.repository \}\}$/v)
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
  // The page travels from the step to the job, and from the job to the
  // caller: a link cut anywhere leaves `needs.<job>.outputs.url` empty.
  it('should be callable without inputs and answer the page it read', () => {
    const call = asRecord(
      asRecord(workflow('reusable-homey-build-link.yml').on, 'on')
        .workflow_call,
      'workflow_call',
    )
    const outputs = asRecord(call.outputs, 'outputs')
    const job = jobOf('reusable-homey-build-link.yml', 'build-link')

    expect(new Set(Object.keys(call))).toStrictEqual(new Set(['outputs']))
    expect(new Set(Object.keys(outputs))).toStrictEqual(new Set(['url']))
    expect(asRecord(outputs.url, 'url').value).toMatch(
      /^\$\{\{ jobs\.build-link\.outputs\.url \}\}$/v,
    )
    expect(asRecord(job.outputs, 'job outputs').url).toMatch(
      /^\$\{\{ steps\.link\.outputs\.url \}\}$/v,
    )
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

  // A refusal is an error, so that it is retried where it can pass and
  // its body never read for a listing, and no request outlasts the job:
  // two of them, a minute each at the most, inside its five.
  it('should bound each request inside the timeout of the job', () => {
    const script = linkScript()

    expect(script).toContain('curl --fail --silent --show-error --location')
    expect(script).toContain('--connect-timeout 10 --max-time 30')
    expect(script).toContain('--retry 3 --retry-max-time 60')
    expect(
      jobOf('reusable-homey-build-link.yml', 'build-link')['timeout-minutes'],
    ).toBe(5)
  })
})

// The self-test is the one proof of the request itself, so its own
// shape is held: it runs when either file moves, calls the reusable of
// the commit under test behind a job named as the publish workflow
// names its own, and spells the page nowhere but in what that job
// prints.
describe('homey-build-link.yml', () => {
  it('should run the reusable whenever either file changes', () => {
    const { on } = workflow('homey-build-link.yml')
    const link = jobOf('homey-build-link.yml', 'build-link')

    expect(
      asRecord(asRecord(on, 'on').pull_request, 'pull_request').paths,
    ).toStrictEqual([
      '.github/workflows/homey-build-link.yml',
      '.github/workflows/reusable-homey-build-link.yml',
    ])
    expect(link.needs).toBe('publish')
    expect(link.uses).toBe('$/.github/workflows/reusable-homey-build-link.yml')
  })

  it('should stand in for the publish job under its name, the page whole in no step', () => {
    const publish = jobOf('homey-build-link.yml', 'publish')

    expect(publish.name).toBe(
      jobOf('reusable-homey-publish.yml', 'publish').name,
    )
    expect(
      JSON.stringify([
        workflow('homey-build-link.yml').env,
        stepsOf('homey-build-link.yml', 'publish'),
      ]),
    ).not.toMatch(/\/build\/\d/v)
  })
})

// The link step's script, run as the runner runs a `shell: bash` step,
// against a stand-in for `curl` that answers the two requests the
// script makes, for this run's attempt and for the publish job's id,
// as the API does: nothing without the token, the log a redirect away,
// and nothing but a status on a refusal, as `--fail` has it. The
// listing names its jobs as a run does that calls the two reusables,
// and the log lines are a release's own (homey 4.6.3, 2026-11-21), the
// app's id and version apart.
describe('the link step of reusable-homey-build-link.yml', () => {
  const APP_PAGE = 'https://tools.developer.homey.app/apps/app/com.example.app'
  const PUBLISH_JOB = 'Publish app on Homey'
  const JOBS = {
    jobs: [
      { id: 42, name: `publish / ${PUBLISH_JOB}` },
      { id: 43, name: 'build-link / Link the uploaded build' },
    ],
  }
  const UPLOADED =
    '2026-11-21T23:21:31.0094861Z ✓ App com.example.app@1.2.3 successfully uploaded.'
  const READING = 'Reading the log of job 42.\n'
  const NO_BUILD = '::warning::The log of the publish job gave no build.\n'
  const NO_JOB = '::warning::This attempt of the run gave no publish job.\n'

  const naming = (build: number): string =>
    `2026-11-21T23:21:31.0095646Z Visit ${APP_PAGE}/build/${String(build)} to publish your app.`

  const sandbox = { directory: '' }

  const link = ({
    jobs = JOBS,
    log,
    status = 0,
    token = 'token',
  }: {
    readonly log: readonly string[]
    readonly jobs?: typeof JOBS
    readonly status?: number
    readonly token?: string
  }): {
    readonly output: string
    readonly status: number | null
    readonly stdout: string
    readonly summary: string
  } => {
    const outputPath = path.join(sandbox.directory, 'output')
    const summaryPath = path.join(sandbox.directory, 'summary')
    writeFileSync(outputPath, '')
    writeFileSync(summaryPath, '')
    const { status: exitStatus, stdout } = spawnSync(
      'bash',
      ['--noprofile', '--norc', '-eo', 'pipefail', '-c', linkScript()],
      {
        cwd: sandbox.directory,
        encoding: 'utf8',
        env: {
          CURL_STATUS: String(status),
          GH_TOKEN: token,
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
      stdout,
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
        "bearer='' follow=''",
        'for argument; do',
        '  case "$argument" in',
        "    'Authorization: Bearer token') bearer=1 ;;",
        '    --location) follow=1 ;;',
        '  esac',
        'done',
        '[ -n "$bearer" ] || exit 22',
        'api=https://api.github.test/repos/owner/app/actions',
        'case "$argument" in',
        '  "$api/runs/7/attempts/2/jobs?per_page=100")',
        String.raw`    printf '%s\n' "$JOBS_JSON" ;;`,
        '  "$api/jobs/42/logs")',
        String.raw`    [ -z "$follow" ] || printf '%s\n' "$JOB_LOG" ;;`,
        'esac',
        '',
      ].join('\n'),
    )
    chmodSync(curl, 0o755)
  })

  afterEach(() => {
    rmSync(sandbox.directory, { force: true, recursive: true })
  })

  // The last page named is the one read: a log names its build once,
  // and a transfer taken twice would name it twice.
  it.each([
    { label: 'the log names', log: [UPLOADED, naming(360)] },
    { label: 'the log names last', log: [naming(359), UPLOADED, naming(360)] },
  ])('should answer and print the page of the build $label', ({ log }) => {
    expect(link({ log })).toStrictEqual({
      output: `url=${APP_PAGE}/build/360\n`,
      status: 0,
      stdout: READING,
      summary: `Publish the uploaded build at ${APP_PAGE}/build/360\n`,
    })
  })

  // An upload that went through is never failed behind: whatever keeps
  // the page from being read leaves an empty answer, a green step, and
  // a warning that says which of the two reads gave nothing.
  it.each([
    {
      label: 'the log names no build',
      options: { log: [UPLOADED] },
      stdout: `${READING}${NO_BUILD}`,
    },
    {
      label: 'the run holds no publish job',
      options: {
        jobs: { jobs: [{ id: 42, name: 'validate / Validate app' }] },
        log: [UPLOADED, naming(360)],
      },
      stdout: NO_JOB,
    },
    {
      label: 'the API refuses',
      options: { log: [UPLOADED, naming(360)], status: 22 },
      stdout: NO_JOB,
    },
    {
      label: 'the token is not the one sent',
      options: { log: [UPLOADED, naming(360)], token: 'another' },
      stdout: NO_JOB,
    },
  ])(
    'should answer no page, warn and still pass when $label',
    ({ options, stdout }) => {
      expect(link(options)).toStrictEqual({
        output: 'url=\n',
        status: 0,
        stdout,
        summary: '',
      })
    },
  )
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
