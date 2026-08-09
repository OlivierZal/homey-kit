# @olivierzal/homey-kit

Shared Homey runtime for the OlivierZal apps: the webview kit
(dirty-gate, freshness handshake), the settings transport, common
helpers and the table-driven test kernels.

[![License](https://img.shields.io/github/license/OlivierZal/homey-kit)](LICENSE)
[![Node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOlivierZal%2Fhomey-kit%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&color=brightgreen)](package.json)
[![GitHub release](https://img.shields.io/github/v/release/OlivierZal/homey-kit?sort=semver)](https://github.com/OlivierZal/homey-kit/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/OlivierZal/homey-kit/ci.yml?branch=main&label=CI)](https://github.com/OlivierZal/homey-kit/actions/workflows/ci.yml)
[![CodeQL](https://github.com/OlivierZal/homey-kit/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/OlivierZal/homey-kit/security/code-scanning)

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_homey-kit&metric=alert_status)](https://sonarcloud.io/dashboard?id=OlivierZal_homey-kit)
[![Test coverage](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_homey-kit&metric=coverage)](https://sonarcloud.io/component_measures?id=OlivierZal_homey-kit&metric=coverage)
[![Docs coverage](https://olivierzal.github.io/homey-kit/coverage.svg)](https://olivierzal.github.io/homey-kit/)

## Install

The package lives on GitHub Packages:

```ini title="npmrc"
@olivierzal:registry=https://npm.pkg.github.com
```

```sh title="install"
npm install @olivierzal/homey-kit
```

Pin it exactly — adoption of a new version is a reviewed PR, never a
range.

## Subpaths

| Import                           | Contents                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@olivierzal/homey-kit`          | `fireAndForget` (+ `Logger`), `getErrorMessage`, `NotFoundError`, `selectChangelogEntries`, `sequential`                                                                                                                                   |
| `@olivierzal/homey-kit/dom`      | Typed element accessors (`getButton`, `getInput`, …), the Homey form-control builders (`createInput`, `createSelect`, …) and the form-value reader (`parseFormValue`)                                                                      |
| `@olivierzal/homey-kit/webview`  | The boot cycle (`runWebview`, `withInitTimeout`, `surfaceError`, `fireAndForget`, `trySetDocumentLanguage`), `createDirtyGate` (exclusive arming: baseline or predicate), `watchWebviewFreshness`, `ensureFreshWebview`, `getPageIdentity` |
| `@olivierzal/homey-kit/settings` | The error-first-callback settings SDK promisified: `homeyApiGet`/`Post`/`Put`/`Delete`, `homeyConfirm`                                                                                                                                     |
| `@olivierzal/homey-kit/widget`   | The promise-native widget SDK typed: `homeyApiGet`/`Post`/`Put`                                                                                                                                                                            |
| `@olivierzal/homey-kit/manifest` | `getDriverSettings`, `getDriverLoginSetting`, `mergeDeviceSettings`, `localize` — the manifest read into a settings page                                                                                                                   |
| `@olivierzal/homey-kit/node`     | `getWebviewHashes` — the packaged `webview-hashes.json` reader the freshness route serves                                                                                                                                                  |
| `@olivierzal/homey-kit/types`    | `TypedManagerDrivers`, `TypedManagerSettings` — generics for the app's `homey` augmentation                                                                                                                                                |
| `@olivierzal/homey-kit/testing`  | `createApiContractSuite`, `createRouteGuardSuite` and their analysis seams (needs vitest)                                                                                                                                                  |

## The DOM subpath

`./dom` holds what every settings page and widget rebuilds otherwise:
element accessors that report the two failures separately — an id that is
absent, and an id that names another kind of element — and the builders
for Homey's `homey-form-*` controls, which are platform markup rather
than app design and so belong in one place.

Class names stay caller-supplied. The settings pages pass their
`homey-form-*` decoration; the widgets pass nothing and style bare
elements through element selectors. One builder serves both, and neither
page inherits the other's look:

```ts title="settings"
import {
  createInput,
  createLabel,
  getFieldset,
} from '@olivierzal/homey-kit/dom'

const input = createInput({ className: 'homey-form-input', id, type })
getFieldset('login').append(createLabel(input, title, 'homey-form-label'))
```

Anything tied to one app's domain stays in that app — zone pickers, log
rows, comboboxes.

## The boot cycle

`./webview` carries the sequence every page runs before it is usable,
and it exists for one invariant: **the loading overlay always ends**. A
page that never reaches `Homey.ready()` spins forever, and the user has
no way to recover but to reinstall.

```ts title="settings page"
import { runWebview, surfaceError } from '@olivierzal/homey-kit/webview'

export const start = async (homey: HomeySettings): Promise<void> => {
  const { error, hasFailed } = await runWebview(homey, init(homey), {
    timeoutMessage: 'Timed out while loading the settings page',
  })
  if (hasFailed) {
    surfaceError(error, 'Unhandled settings error')
  }
}
```

`ready` fires in a `finally`, so a rejecting init, a page that throws
while building itself, and a transport that never answers all end the
same way. The deadline **rejects** rather than resolves — a hung fetch
must surface as an error, not resolve silently into a half-built page —
and the work is not cancelled, so a late success repaints over the
degraded state.

Where the failure is announced is the caller's choice, and both moments
are real: `onError` runs before `ready`, for a widget that must paint an
error at the right size; the returned outcome is read after it, for a
page that would rather let the overlay close first. Messages are
parameters, not policy — the settings pages and the widgets name
themselves differently, and neither should have to accept the other's
wording to share the cycle.

## The manifest subpath

`./manifest` turns what Homey states in the app manifest — a driver's
settings, nested in groups and localized, and its pairing login form —
into the flat list of controls a settings page renders. It is node-side:
the app reads its own manifest and serves the result to the page.

```ts title="app"
import {
  getDriverLoginSetting,
  getDriverSettings,
} from '@olivierzal/homey-kit/manifest'

const language = this.homey.i18n.getLanguage()
const settings = this.homey.manifest.drivers.flatMap((driver) => [
  ...getDriverSettings(driver, language),
  ...getDriverLoginSetting(driver, language),
])
```

The manifest types here describe only the fields that are read, so an
app's own richer manifest type stays assignable — which is what lets this
subpath name no SDK type, and the package keep no peers.

`mergeDeviceSettings` folds several devices' stored values into the one
value a grouped control shows: a setting they disagree on collapses to
`null` while the settings they agree on keep folding independently.

## No dependencies, and no peers either

This package declares nothing — no `dependencies`, no
`peerDependencies`, optional or not. The apps install it as a
production dependency, so anything it named would ship to the device;
the two subpaths that need an outside package (`./testing` wants
`vitest`, `./settings` wants the `homey` types) import what every
consumer already has as a devDependency, and a missing one fails
loudly at its own call site. The full reasoning and the incident
behind it live in `CLAUDE.md`.

## Wiring the type augmentations

Module augmentation cannot ship in a package; each app keeps a local
`homey-override.d.ts`. Extend the SDK interfaces and take the narrowed
member SIGNATURES from the generics — do not extend the generics
directly:

```ts title="homey-override"
import type HomeyLib from 'homey/lib/Homey.js'

import type {
  TypedManagerDrivers,
  TypedManagerSettings,
} from '@olivierzal/homey-kit/types'
import type MyApp from './app.mts'
import type { HomeySettings, MyDriver } from './types.mts'

declare module 'homey' {
  interface Homey extends HomeyLib {
    app: MyApp
  }
  interface ManagerDrivers extends HomeyLib.ManagerDrivers {
    getDrivers: TypedManagerDrivers<MyDriver>['getDrivers']
  }
  interface ManagerSettings extends HomeyLib.ManagerSettings {
    get: TypedManagerSettings<HomeySettings>['get']
    set: TypedManagerSettings<HomeySettings>['set']
    unset: TypedManagerSettings<HomeySettings>['unset']
  }
}
```

`interface ManagerDrivers extends TypedManagerDrivers<MyDriver> {}` is a
trap, measured on two apps: without `HomeyLib.ManagerDrivers` the
interface loses `log`, `error`, `getDriver` and 14 more members; adding
both parents makes each declare `getDrivers`, and TypeScript resolves
the conflict **silently** towards the SDK's wide type — `getDrivers()`
hands back `Device[]` where the app expects `MyDriver[]`, with no error
anywhere. Picking the members keeps one declaration site per member, so
a future divergence is a compile error rather than a silent widening.

`TypedManagerSettings` takes the app's keys and nothing else — there is
no `(key: string)` overload. An app that must address settings
dynamically, to satisfy an outside interface imposing `key: string`,
narrows at that one boundary:

```ts title="adapter"
const settingKey = (key: string): keyof HomeySettings =>
  key as keyof HomeySettings
```

The knowledge lives there and nowhere else: only the adapter knows the
keys it forwards are real. A global escape hatch would spend that one
narrowing across every call site in the app, and a typo would read
`undefined` at runtime instead of failing to compile.

## Wiring the test kernels

Each app keeps its tables **and its own `describe`/`it` blocks** — a
test file that declares no test reads as empty to Sonar and to any
reader — while the comparisons stay single-sourced here:

```ts title="tests"
import {
  analyzeRouteGuards,
  findContractBreach,
} from '@olivierzal/homey-kit/testing'

it.each(SURFACES)('$name declares exactly its handlers', (surface) => {
  expect(findContractBreach(surface)).toBeNull()
})

it('declares every path its webview sources call', async () => {
  const findings = await analyzeRouteGuards({
    manifest: '.homeycompose/app.json',
    name: 'settings',
    sourceDirs: ['settings'],
  })

  expect(findings.undeclaredPaths).toStrictEqual([])
})
```

The compile-time half of the contract stays app-side too: asserting
`expectTypeOf<Handler>().toBeFunction()` over the surface's handler
union typechecks only when every handler is callable.

## Wiring the freshness handshake

The manifest URL is required: it sits where the app's own bundler
stamped it, which no path relative to this package can reach. Bind it
once, app-side, and serve it from the route the pages call:

```ts title="lib/webview-hashes"
import { getWebviewHashes } from '@olivierzal/homey-kit/node'

const MANIFEST_URL = new URL('../webview-hashes.json', import.meta.url)

export const readWebviewHashes = async (): Promise<
  Partial<Record<string, string>>
> => getWebviewHashes(MANIFEST_URL)
```

Pages wire the whole handshake in one call, `watchWebviewFreshness`,
whose `report` argument is the diagnostics channel: point it at the
app's boot-error route so a refetch that is skipped or that fails to
heal leaves a trace instead of a silently stale page.

```ts title="settings/index"
if (
  await watchWebviewFreshness({
    entry: 'settings',
    fetchHashes: async () => homeyApiGet(homey, '/webview-hashes'),
    report: (message) => {
      reportFreshness(homey, message)
    },
    subscribe: (onPoke) => {
      homey.on('webview_hashes_changed', onPoke)
    },
  })
) {
  // The document is being replaced: skip this page's own init.
  return
}
```

The guarantee lives in the boot check; the foreground trigger carries
it to the one surface where no boot happens — a mobile webview
surviving an app restart. Why the `subscribe` poke cannot carry it
(measured on-device) and why the two must never be folded together is
maintainer doctrine, in `CLAUDE.md`.

Everything the caller hands over is fenced: a `report` that throws, a
`subscribe` that throws, a rejecting `fetchHashes`, an unregistrable
listener or a detached document all degrade the self-heal and never
stop the page from booting.

`ensureFreshWebview` stays exported as the single-check primitive under
`watchWebviewFreshness`, for a page that owns its own triggers.

`getPageIdentity()` returns what the page compared — the document-order
join of its `?v=` stamps. Displaying it answers "am I looking at a
cached page?" at a glance, which the app version cannot: phone webviews
cache assets across app versions, so the version on screen says nothing
about the bundle behind it.

## Announcing skipped versions

An app notifies the changelog on boot and stores the version it
announced. Selecting only the running version means a user who updates
rarely never hears about the releases in between, so
`selectChangelogEntries` walks the stored version up to the running one:

```ts title="app"
const { entries, omitted } = selectChangelogEntries({
  changelog,
  from: this.homey.settings.get('notifiedVersion'),
  language: this.homey.i18n.getLanguage(),
  to: this.homey.manifest.version,
})
```

`entries` is chronological — announce it in that order. A first install
(no readable `from`) yields only the running version, never the whole
history; a downgrade yields nothing. Each version falls back to English
when the user's language is missing, and a version translated into
neither drops out of the series instead of ending it. Beyond five
versions only the most recent are returned, the rest counted in
`omitted` so the caller can say so rather than drop them silently.

Emission stays in the app: `createNotification` and the
`notifiedVersion` write are SDK-coupled, and only the selection is
shared.
