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

// The three Homey process workflows this package hosts since 6.1.0 —
// the apps' validate and publish paths, and the iOS floor watch — are
// release-only or scheduled, so what a static read can hold is the
// shape the callers depend on: the call surface, the environment and
// the grants the jobs claim, and the injection posture of the scripts
// that read inputs or a secret. A rename or a dropped grant fails here
// rather than at three apps' next release. The one script that decides
// something, the publish step's, is run as well: against the lines the
// Homey CLI prints, with a stand-in for it.

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

const publishStep = (): Record<string, unknown> =>
  asRecord(
    stepsOf('reusable-homey-publish.yml', 'publish').find(
      ({ name }) => name === 'Publish',
    ),
    'the publish step',
  )

const publishScript = (): string => {
  const { run } = publishStep()
  if (typeof run !== 'string') {
    throw new TypeError('the publish step has no script')
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

  // The environment's link is the page the publish step answers: the
  // build's, one click from the run.
  it('should publish from the homey environment with the read grants only', () => {
    const publish = jobOf('reusable-homey-publish.yml', 'publish')
    const environment = asRecord(publish.environment, 'environment')

    expect(new Set(Object.keys(environment))).toStrictEqual(
      new Set(['name', 'url']),
    )
    expect(environment.name).toBe('homey')
    expect(environment.url).toMatch(
      /^\$\{\{ steps\.publish\.outputs\.url \}\}$/v,
    )
    expect(publish.permissions).toStrictEqual({
      contents: 'read',
      packages: 'read',
    })
  })

  // The CLI states the Node it runs on, and npm settles without a word
  // for an older CLI under an older Node (4.4.0 under Node 22, where
  // the latest was 4.6.3): the job runs on the current LTS, as Athom's
  // own action does, and asks for the latest by name. The CLI's
  // packages run no install script, none of them is younger than the
  // seven days Dependabot waits here, and the step that fetches them
  // holds no secret.
  it('should fetch the latest CLI on the current LTS, without scripts or secrets', () => {
    const steps = stepsOf('reusable-homey-publish.yml', 'publish')
    const setup = asRecord(
      steps.find(
        ({ uses }) =>
          typeof uses === 'string' && uses.endsWith('setup-node-and-install'),
      )?.with,
      'the install inputs',
    )
    const install = asRecord(
      steps.find(({ name }) => name === 'Install the Homey CLI'),
      'the CLI install step',
    )

    expect(setup['node-version']).toBe('lts/*')
    expect(install.run).toBe(
      'npm install --global --ignore-scripts --min-release-age=7 homey@latest',
    )
    expect(install.env).toBeUndefined()
  })

  // The token reaches the CLI through the environment, never
  // interpolated into the script, and `shell: bash` is what makes a
  // failed upload fail the step through the `tee` (`pipefail`).
  it('should hand the CLI its token from the environment, headless', () => {
    const { env: stepEnv, id, run, shell } = publishStep()
    const env = asRecord(stepEnv, 'publish env')

    expect(id).toBe('publish')
    expect(new Set(Object.keys(env))).toStrictEqual(
      new Set(['HOMEY_HEADLESS', 'HOMEY_PAT']),
    )
    expect(env.HOMEY_HEADLESS).toBe('1')
    expect(env.HOMEY_PAT).toMatch(/^\$\{\{ secrets\.HOMEY_PAT \}\}$/v)
    expect(run).not.toMatch(/\$\{\{/v)
    expect(shell).toBe('bash')
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

// The publish step's script, run as the runner runs a `shell: bash`
// step, against a stand-in for `homey` that prints what it is told and
// exits as it is told. The lines are the CLI's own, off a release's
// log (homey 4.6.3, 2026-11-21), the app's id apart.
describe('the publish step of reusable-homey-publish.yml', () => {
  const APP_PAGE = 'https://tools.developer.homey.app/apps/app/com.example.app'
  const UPLOADED = [
    '✓ Submitting com.example.app@1.2.3...',
    ' — App archive size: 20.99 MB, 2212 files',
    '✓ Created Build ID 360',
    '✓ Uploading com.example.app@1.2.3...',
    '✓ App com.example.app@1.2.3 successfully uploaded.',
  ]

  const sandbox = { directory: '' }

  const publish = ({
    lines,
    status = 0,
  }: {
    readonly lines: readonly string[]
    readonly status?: number
  }): { readonly output: string; readonly status: number | null } => {
    const outputPath = path.join(sandbox.directory, 'output')
    writeFileSync(outputPath, '')
    const { status: exitStatus } = spawnSync(
      'bash',
      ['--noprofile', '--norc', '-eo', 'pipefail', '-c', publishScript()],
      {
        cwd: sandbox.directory,
        env: {
          CLI_LINES: lines.join('\n'),
          CLI_STATUS: String(status),
          GITHUB_OUTPUT: outputPath,
          PATH: [sandbox.directory, process.env.PATH].join(path.delimiter),
          RUNNER_TEMP: sandbox.directory,
        },
      },
    )
    return { output: readFileSync(outputPath, 'utf8'), status: exitStatus }
  }

  beforeEach(() => {
    sandbox.directory = mkdtempSync(path.join(tmpdir(), 'homey-publish-'))
    writeFileSync(
      path.join(sandbox.directory, 'app.json'),
      JSON.stringify({ id: 'com.example.app' }),
    )
    const cli = path.join(sandbox.directory, 'homey')
    writeFileSync(
      cli,
      '#!/bin/sh\nprintf \'%s\\n\' "$CLI_LINES"\nexit "$CLI_STATUS"\n',
    )
    chmodSync(cli, 0o755)
  })

  afterEach(() => {
    rmSync(sandbox.directory, { force: true, recursive: true })
  })

  it('should answer the page of the build the CLI names', () => {
    expect(
      publish({
        lines: [
          ...UPLOADED,
          '',
          `Visit ${APP_PAGE}/build/360 to publish your app.`,
        ],
      }),
    ).toStrictEqual({ output: `url=${APP_PAGE}/build/360\n`, status: 0 })
  })

  it("should answer the app's page when the CLI names no build", () => {
    expect(publish({ lines: UPLOADED })).toStrictEqual({
      output: `url=${APP_PAGE}\n`,
      status: 0,
    })
  })

  it('should fail, and answer no page, when the CLI fails', () => {
    expect(
      publish({
        lines: [
          '✖ The app is not valid, please fix the validation issues first.',
        ],
        status: 1,
      }),
    ).toStrictEqual({ output: '', status: 1 })
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
