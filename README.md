# @olivierzal/homey-kit

Shared building blocks for the OlivierZal Homey apps: helpers for
settings pages, widgets, app code and tests, and reusable GitHub
workflows.

[![License](https://img.shields.io/github/license/OlivierZal/homey-kit)](https://github.com/OlivierZal/homey-kit/blob/main/LICENSE)
[![Node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOlivierZal%2Fhomey-kit%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&color=brightgreen)](https://github.com/OlivierZal/homey-kit/blob/main/package.json)
[![GitHub release](https://img.shields.io/github/v/release/OlivierZal/homey-kit?sort=semver)](https://github.com/OlivierZal/homey-kit/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/OlivierZal/homey-kit/ci.yml?branch=main&label=CI)](https://github.com/OlivierZal/homey-kit/actions/workflows/ci.yml)
[![CodeQL](https://github.com/OlivierZal/homey-kit/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/OlivierZal/homey-kit/security/code-scanning)

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_homey-kit&metric=alert_status)](https://sonarcloud.io/dashboard?id=OlivierZal_homey-kit)
[![Test coverage](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_homey-kit&metric=coverage)](https://sonarcloud.io/component_measures?id=OlivierZal_homey-kit&metric=coverage)
[![Docs coverage](https://olivierzal.github.io/homey-kit/coverage.svg)](https://olivierzal.github.io/homey-kit/)

## Features

- Settings pages and widgets that always end Homey's loading overlay.
- Promise-based calls to your app's API from a page or a widget.
- Form-control builders and an Apply-button gate.
- Cached pages that reload themselves once after an app update.
- Manifest readers for a driver's settings and login form.
- `homey.drivers` and `homey.settings` typed for your app.
- A changelog announcement that covers the versions a user skipped.
- Helpers for background work, grouped work and error messages.
- Test helpers that check your app's API against its manifest, and its
  generated locale files against their sources.
- Reusable GitHub workflows that validate and publish a Homey app.
- No dependency: nothing else is installed with it.

## Requirements

- Node.js `>=22.20.0`, ESM only.
- A GitHub personal access token with the `read:packages` scope, to
  install the package.
- Yours to install, since the package installs nothing else: `vitest`
  for `@olivierzal/homey-kit/testing`, and the Homey SDK types
  (`homey-apps-sdk-v3-types`, installed as `@types/homey`) for
  `@olivierzal/homey-kit/settings`.
- A bundler for page code. The entry points that run in a page use no
  JavaScript API newer than ES2023.

## Installation

The package is published to GitHub Packages. Point the `@olivierzal`
scope at it, with that token in `NODE_AUTH_TOKEN`:

```ini title=".npmrc"
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
@olivierzal:registry=https://npm.pkg.github.com
```

Then install the package at an exact version:

```sh title="install"
npm install --save-exact @olivierzal/homey-kit
```

## Quick start

A settings page that reads one of your app's routes and always opens:

```ts title="settings/index.mts"
import type HomeySettings from 'homey/lib/HomeySettings.js'
import {
  homeyApiGet,
  watchSettingsFreshness,
} from '@olivierzal/homey-kit/settings'
import { runWebview, surfaceError } from '@olivierzal/homey-kit/webview'

const init = async (homey: HomeySettings): Promise<void> => {
  if (await watchSettingsFreshness(homey)) {
    return
  }
  document.body.textContent = await homeyApiGet<string>(homey, '/name')
}

export const start = async (homey: HomeySettings): Promise<void> => {
  await runWebview(homey, init(homey), { onError: surfaceError })
}
```

Bundle the module and call `start(homey)` from the page's
`onHomeyReady`. `/name` stands for a route your app declares, and
`watchSettingsFreshness` resolves to `false` until the page is stamped
(see "Keep cached pages fresh").

A widget does the same from `@olivierzal/homey-kit/widget`, names its
own entry and gives `runWebview` its height:

```ts title="widgets/charts/public/index.mts"
import type HomeyWidget from 'homey/lib/HomeyWidget.js'
import { runWebview, surfaceError } from '@olivierzal/homey-kit/webview'
import { homeyApiGet, watchWidgetFreshness } from '@olivierzal/homey-kit/widget'

const init = async (homey: HomeyWidget): Promise<void> => {
  if (await watchWidgetFreshness(homey, 'charts')) {
    return
  }
  document.body.textContent = await homeyApiGet<string>(homey, '/name')
}

export const start = async (homey: HomeyWidget): Promise<void> => {
  await runWebview(homey, init(homey), {
    height: () => document.body.scrollHeight,
    onError: surfaceError,
  })
}
```

## Usage

| Import                           | What it gives                                                                                 | Runs in               |
| -------------------------------- | --------------------------------------------------------------------------------------------- | --------------------- |
| `@olivierzal/homey-kit`          | Background and grouped work, error messages, the changelog announcement, the settings adapter | App and pages         |
| `@olivierzal/homey-kit/webview`  | Page boot, the Apply gate, the freshness check                                                | Settings page, widget |
| `@olivierzal/homey-kit/dom`      | Element lookups, form-control builders, the form-value reader                                 | Settings page, widget |
| `@olivierzal/homey-kit/settings` | App-API calls and the freshness check of a settings page                                      | Settings page         |
| `@olivierzal/homey-kit/widget`   | App-API calls and the freshness check of a widget                                             | Widget                |
| `@olivierzal/homey-kit/manifest` | Readers of the drivers' settings in the app manifest                                          | App                   |
| `@olivierzal/homey-kit/node`     | The page stamper and the reader of its hashes                                                 | Build script, app     |
| `@olivierzal/homey-kit/types`    | Types for `homey.drivers` and `homey.settings`                                                | Types only            |
| `@olivierzal/homey-kit/testing`  | API-contract and locale checks, test helpers                                                  | Tests                 |

`fireAndForget`, `homeyApiGet`, `homeyApiPost` and `homeyApiPut` exist
in two entry points with different signatures: import each from the one
that matches where the code runs.

### Boot a page

`runWebview(homey, work, options)` always calls `homey.ready()`: when
the work resolves, when it rejects, and after 10 seconds when it has
done neither (the work is not cancelled). A failure does not make it
reject: it resolves to `{ error, hasFailed }`. The `onError` option
runs before `ready()`, for a page that paints its error first; read the
returned outcome instead to report once the overlay has closed. A
widget passes `height`, a function that returns its height, and
`ready()` receives it. `surfaceError` reports an error as an uncaught
error of the page, without throwing where it is called.

### Call the app API

In a settings page, `homeyApiGet`, `homeyApiPost` and `homeyApiPut`
resolve to the handler's result, `homeyApiDelete` resolves when the
handler is done, and `homeyConfirm` resolves to whether the user
confirmed. In a widget, `homeyApiGet` resolves to the handler's result,
`homeyApiPost` and `homeyApiPut` take an object and resolve to nothing,
and there is no delete. A call that fails rejects with the error Homey
reports. A result is typed as you ask and is not validated.

### Gate the Apply button

```ts title="settings/name-form.mts"
import type HomeySettings from 'homey/lib/HomeySettings.js'
import { getButton, getFieldset, getInput } from '@olivierzal/homey-kit/dom'
import { homeyApiPut } from '@olivierzal/homey-kit/settings'
import { createDirtyGate, fireAndForget } from '@olivierzal/homey-kit/webview'

export const wireNameForm = (homey: HomeySettings): void => {
  const nameElement = getInput('name')
  const applyElement = getButton('apply')
  const gate = createDirtyGate({
    applyElement,
    fieldsetElements: [getFieldset('name_form')],
    serialize: () => nameElement.value,
  })
  gate.wire([nameElement])
  applyElement.addEventListener('click', () => {
    fireAndForget(
      gate.runBusy(async () => {
        await homeyApiPut(homey, '/name', { name: nameElement.value })
        gate.markSaved()
      }),
    )
  })
}
```

Apply is disabled while `serialize()` returns what it returned at the
last `markSaved()`, or at creation, and while a request is in flight.
`runBusy` marks a request in flight while its action runs (when calls
overlap, the latest one ends it), and the fieldsets are disabled
meanwhile. `wire` re-evaluates on each
`input` and `change` event of its targets: call `recompute()` after you
set a field from code. With `isActionable: () => boolean` instead of
`serialize`, you decide when Apply has something to send.

### Build and read form controls

`createInput({ id, type, value })`, `createSelect(id, options)` and
`createLabel(control, text)` build controls that are not in the
document yet. Each takes an optional class name, and a select starts
with an empty option. The element lookups throw a `TypeError` that
tells a missing id from an id of another kind of element.

`parseFormValue(control)` returns `null` for an empty value, a
checkbox's checked state (`null` while indeterminate), `true` or
`false` for `'true'` and `'false'`, a number when the value converts to
a finite number, and the string otherwise. A select is read the same
way: an option id that looks numeric comes back as a number, so give a
non-numeric id to an option that must stay a string.

### Keep cached pages fresh

A phone can keep showing a cached settings page or widget after an app
update. Three steps make an outdated page reload itself once. First,
stamp the packaged pages from the script that bundles them:

```ts title="scripts/bundle.mts"
import { stampPackagedPages } from '@olivierzal/homey-kit/node'

await stampPackagedPages('.homeybuild', [
  { entry: 'settings', page: 'settings/index.html' },
  { entry: 'charts', page: 'widgets/charts/public/index.html' },
])
```

In the directory the Homey CLI packs, this adds a `?v=` stamp to every
local `href` and `src` of each page and writes `webview-hashes.json`.
It does nothing when none of the pages exists, and rejects when only
some exist or one has no local reference.

Then give the pages two routes, in the app's API for the settings page
and in each widget's API for that widget:

```ts title="api.mts"
import type { Homey } from 'homey'
import { getWebviewHashes } from '@olivierzal/homey-kit/node'

const api = {
  getWebviewHashes: async (): Promise<Partial<Record<string, string>>> =>
    getWebviewHashes(new URL('webview-hashes.json', import.meta.url)),
  logWebviewBoot: ({ body, homey }: { body: unknown; homey: Homey }): void => {
    homey.app.error('Page boot failed:', JSON.stringify(body))
  },
}

export default api
```

Declare them as `GET /webview-hashes` and `POST /boot-error`, in the
app manifest and in each widget's manifest. The `URL` is relative to
the module that builds it, here one at the app's root. The second route
receives `{ message, name: 'WebviewFreshness' }` when a page finds
itself outdated.

Finally, start a settings page with `watchSettingsFreshness(homey)`, as
the quick start does, or a widget with
`watchWidgetFreshness(homey, 'charts')`, and stop when it resolves to
`true`: the page is reloading. The settings page is looked up under the
entry `settings`. The check runs again each time the page becomes
visible. It resolves to `false` when it cannot conclude (an unstamped
page, an unknown entry, a failing route) or cannot reload safely
(blocked storage).

### Read the manifest into settings controls

```ts title="lib/driver-settings.mts"
import type { Homey } from 'homey'
import {
  type DriverSetting,
  getDriverLoginSetting,
  getDriverSettings,
} from '@olivierzal/homey-kit/manifest'

export const listDriverSettings = (homey: Homey): DriverSetting[] => {
  const language = homey.i18n.getLanguage()
  return (homey.manifest.drivers ?? []).flatMap((driver) => [
    ...getDriverSettings(driver, language),
    ...getDriverLoginSetting(driver, language),
  ])
}
```

`getDriverSettings` returns one `DriverSetting` per control a driver
declares, each with the `groupId` and `groupLabel` of the innermost
group it sits in. `getDriverLoginSetting` returns the `username` and
`password` controls of the `login` pairing step. Labels come in the
language asked for, else in English.
`mergeDeviceSettings(merged, device.getSettings())`, called for each
device, keeps in `merged` the values the devices agree on and sets the
others to `null`.

### Type the Homey instance

With the Homey SDK types 1.x, `homey.app` is typed once your app
declares this:

```ts title="homey-override.d.ts"
import type MyApp from './app.mts'

declare module 'homey' {
  interface HomeyTypes {
    app: MyApp
  }
}
```

`homey.drivers` and `homey.settings` are narrowed in your app, with the
member signatures of `@olivierzal/homey-kit/types`:

```ts title="types/homey.mts"
import type {
  TypedManagerDrivers,
  TypedManagerSettings,
} from '@olivierzal/homey-kit/types'
import type { Homey } from 'homey'
import type SdkManagerDrivers from 'homey/manager/drivers.js'
import type SdkManagerSettings from 'homey/manager/settings.js'

import type MyDriver from '../drivers/my-driver/driver.mts'
import type { HomeySettings } from './app-settings.mts'

export interface ManagerDrivers extends SdkManagerDrivers {
  readonly getDrivers: TypedManagerDrivers<MyDriver>['getDrivers']
}

export interface ManagerSettings extends SdkManagerSettings {
  readonly get: TypedManagerSettings<HomeySettings>['get']
  readonly set: TypedManagerSettings<HomeySettings>['set']
  readonly unset: TypedManagerSettings<HomeySettings>['unset']
}

export interface MyHomey extends Homey {
  readonly drivers: ManagerDrivers
  readonly settings: ManagerSettings
}
```

Keep that shape: each interface extends the SDK's manager and takes
only the narrowed members from the generic. Your app class then
declares `declare public readonly homey: MyHomey`, and a driver or a
device reaches the typed managers through `this.homey.app.homey`.

### Store an API library's session in the app settings

Once narrowed, `homey.settings` accepts your setting keys only, and an
API library stores its session under plain string keys (the
`settingManager` of `@olivierzal/melcloud-api` and
`@olivierzal/heatzy-api`). `createSettingManager` adapts one to the
other:

```ts title="lib/setting-manager.mts"
import {
  type SettingManager,
  createSettingManager,
} from '@olivierzal/homey-kit'

import type { HomeySettings } from '../types/app-settings.mts'
import type { ManagerSettings } from '../types/homey.mts'

// The one place where a key of the library becomes one of yours
const settingKey = (key: string): keyof HomeySettings =>
  key as keyof HomeySettings

export const toSettingManager = (settings: ManagerSettings): SettingManager =>
  createSettingManager(settings, settingKey)
```

`settingKey` is required: prefix the key there when two API clients
share the store. A stored value that is not a string reads as absent.

### Announce the changelog

```ts title="app.mts"
import { announceChangelog } from '@olivierzal/homey-kit'
import Homey from 'homey'

import changelog from './.homeychangelog.json' with { type: 'json' }

export default class MyApp extends Homey.App {
  public override onInit(): void {
    announceChangelog({
      changelog,
      homey: this.homey,
      language: this.homey.i18n.getLanguage(),
      notifications: this.homey.notifications,
      settings: this.homey.settings,
      version: this.homey.manifest.version,
    })
  }
}
```

It posts one notification per version newer than the one stored under
the `notifiedVersion` setting, oldest first and at most the five
newest, 10 seconds after the call. A first install announces the
running version only. An excerpt comes in the language given, else in
English. `notifiedVersion` is updated once all are posted: if one
fails, the next start tries again.

### Run background work and log routes

`fireAndForget`, `settleAll` and `logSettingsRoute` come from
`@olivierzal/homey-kit`. An app, a driver or a device passes itself as
the logger:
`fireAndForget(promise, this, 'Sync failed:')` returns at once and logs
a rejection with `this.error`, and
`settleAll(promises, this, 'Sync failed:')` waits for every promise,
logs each rejection the same way and never rejects. In an API handler,
`logSettingsRoute(homey.app, 'GET /settings/drivers')` leaves in the
app log which route a settings page called.

### Test the API contract

The package gives the comparisons; you declare the tests, with `vitest`:

```ts title="tests/unit/api.test.ts"
import {
  analyzeRouteGuards,
  findContractBreach,
} from '@olivierzal/homey-kit/testing'
import { describe, expect, it } from 'vitest'

import config from '../../.homeycompose/app.json' with { type: 'json' }
import api from '../../api.mts'

describe('app API', () => {
  it('should declare exactly the handlers its manifest names', () => {
    expect(findContractBreach({ api, config, name: 'app API' })).toBeNull()
  })

  it('should call only declared routes from the settings page', async () => {
    const findings = await analyzeRouteGuards({
      manifest: '.homeycompose/app.json',
      name: 'settings',
      sourceDirs: ['settings'],
    })
    const { accountedCallSites, parsedOrIndirectCalls } = findings
    expect(findings.undeclaredPaths).toStrictEqual([])
    expect(findings.undeclaredMethodCalls).toStrictEqual([])
    expect(findings.undeclaredTemplateCalls).toStrictEqual([])
    expect(parsedOrIndirectCalls).toBeGreaterThanOrEqual(accountedCallSites)
  })
})
```

`findContractBreach` returns `null` when the handlers your API module
exports are exactly the ids its manifest declares. `analyzeRouteGuards`
reads the `.mts` and `.html` files directly in each source directory
and checks their `homeyApiGet`, `homeyApiPost`, `homeyApiPut`,
`homeyApiDelete` and `homey.api` calls against the declared routes. The
last assertion fails when a call escaped the analysis.

### Test the generated locales

The Homey CLI generates `locales/<language>.json` by merging
`.homeycompose/locales/<language>.json` into the file it finds, and it
never removes a text. `findLocaleDrift` tells you when the two have come
apart:

```ts title="tests/unit/locales.test.ts"
import { findLocaleDrift } from '@olivierzal/homey-kit/testing'
import { describe, expect, it } from 'vitest'

describe('locales', () => {
  it('should generate exactly what their sources declare', async () => {
    await expect(findLocaleDrift('.')).resolves.toStrictEqual([])
  })
})
```

The argument is your app's directory. The result holds one entry per
language that drifted, each text named by its path (`settings.title`):

| List            | The text                                       | Fix                                                         |
| --------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `generatedOnly` | Is in the generated file and not in its source | Move it to the source, or delete it from the generated file |
| `sourceOnly`    | Is in the source and not in the generated file | Build the app again                                         |
| `differing`     | Is worded differently in the generated file    | Build the app again                                         |

A language that has only one of the two files is listed with all its
texts.

### Validate and publish with GitHub Actions

| Workflow                        | Inputs                    | Secret      | Output | Permissions to grant               |
| ------------------------------- | ------------------------- | ----------- | ------ | ---------------------------------- |
| `reusable-homey-validate.yml`   | None                      | None        | None   | `contents: read`, `packages: read` |
| `reusable-homey-publish.yml`    | `bundles`, `stamped-page` | `HOMEY_PAT` | None   | `contents: read`, `packages: read` |
| `reusable-homey-build-link.yml` | None                      | None        | `url`  | `actions: read`                    |

```yaml title=".github/workflows/publish.yml"
jobs:
  build-link:
    needs: publish
    permissions:
      actions: read
    uses: OlivierZal/homey-kit/.github/workflows/reusable-homey-build-link.yml@<commit sha> # vX.Y.Z
  publish:
    permissions:
      contents: read
      packages: read
    secrets:
      HOMEY_PAT: ${{ secrets.HOMEY_PAT }}
    uses: OlivierZal/homey-kit/.github/workflows/reusable-homey-publish.yml@<commit sha> # vX.Y.Z
    with:
      bundles: |
        settings/index.js
name: Publish app on Homey
on:
  release:
    types: [published]
  workflow_dispatch: {}
permissions: {}
```

Pin each workflow to the commit of the release you installed, with its
tag as a comment. Validate takes no input: call it the same way from a
workflow that runs on pull requests. It installs on Node 22 with
`npm ci --ignore-scripts`, reading GitHub Packages with the job's
`GITHUB_TOKEN`, then runs Athom's validator at the `publish` level.

Publish installs the same way, runs in an environment named `homey` and
uploads a build with `HOMEY_PAT`, your Homey developer token. It then
fails the run when a file of `bundles` (one path per line) or
`stamped-page` (default `settings/index.html`), both relative to
`.homeybuild`, is missing or empty, or when that page is unstamped.
Build link writes the address of the uploaded build's page, where you
publish the build, to the run summary. It returns that address as
`url`: empty, with a warning, when it cannot read it.

## API reference

The generated reference is at <https://olivierzal.github.io/homey-kit/>.
It documents every export of the nine entry points, including the
lower-level pieces this page does not show.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report a problem on the
[issue tracker](https://github.com/OlivierZal/homey-kit/issues).

## Security

For vulnerability reports, see [SECURITY.md](SECURITY.md).

## Changelog

See the [GitHub release notes](https://github.com/OlivierZal/homey-kit/releases).

## License

[MIT](LICENSE) © Olivier Zalmanski
