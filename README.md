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
| `@olivierzal/homey-kit/dom`      | Typed element accessors (`getButton`, `getInput`, …) and the Homey form-control builders (`createInput`, `createSelect`, …)                                                                                                                |
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

This package declares nothing — no `dependencies`, and deliberately no
`peerDependencies`. The apps install it as a PRODUCTION dependency (the
`node` subpath runs on the device), so anything it names is installed on
the device: a `vitest` peer, optional or not, put 39 packages and 39 MB
of test framework and bundlers onto a Homey, vulnerabilities included.
Optional peers do not save you — the consumer's lockfile records the
link, and `npm ci --omit=dev` installs it.

The two subpaths that need an outside package get it from the consumer
instead: `./testing` imports `vitest`, which every consumer already has
as a devDependency, and `./settings` imports `homey` types, which the
apps have aliased as `@types/homey`. A missing one fails loudly at its
own call site, in a dev context, which is the right place to learn it.

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

Each app keeps only its tables:

```ts title="tests"
import {
  createApiContractSuite,
  createRouteGuardSuite,
} from '@olivierzal/homey-kit/testing'

createRouteGuardSuite([
  {
    manifest: '.homeycompose/app.json',
    name: 'settings',
    sourceDirs: ['settings'],
  },
])
createApiContractSuite<Handler>([{ api, config: appConfig, name: 'app API' }])
```

The `Handler` type parameter is the compile-time half of the contract:
the call only typechecks when the whole handler union is callable.

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

**The guarantee lives in the boot check, and the foreground trigger is
what carries it where no boot happens.** A new document checks itself,
so every surface that remounts its page is fresh for free — the Homey
web app tears the settings page down while the app restarts and mounts
it again, which is why it never looks stale. A mobile webview instead
survives the restart: no new document, no boot check, and the page
stays stale indefinitely. `watchWebviewFreshness` re-checks whenever
the page returns to the foreground, which is the moment that case
resolves itself.

Do not fold that trigger into the `subscribe` poke. Measured on-device:
the app emits `webview_hashes_changed` at the end of its own `onInit`,
i.e. exactly when the restart has just disconnected every open page, so
its audience is absent by construction — an open page produced no hash
call and no breadcrumb. The poke is kept because it costs nothing where
it does arrive; it guarantees nothing anywhere.

Everything the caller hands over is fenced: a `report` that throws, a
`subscribe` that throws, a rejecting `fetchHashes`, an unregistrable
listener or a detached document all degrade the self-heal and never
stop the page from booting.

`ensureFreshWebview` remains exported for a page that owns its own
triggers — the widget bootstraps use it directly.

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

## What belongs here

Two bars, because two different things prove generality.

**Our own code** enters when it is identical in at least two apps, has
been stable for a full cycle, and carries no hidden coupling to a Homey
SDK version. Two consumers are the evidence: one app's helper is one
app's opinion, and hoisting it early freezes a shape nothing has tested
against a second set of needs.

**Homey's platform surface** enters at one consumer: the SDK transports,
the `homey-form-*` markup, the boot cycle. Its generality comes from the
platform, not from our usage — a second app would rediscover the same
API because the platform hands it the same API. Waiting for that
rediscovery buys nothing and costs a divergent second implementation,
which is exactly how the settings pages ended up with three spellings of
the same element accessor.

The distinction matters because "it looks generic" is available as an
argument for anything. It is not the test. The test is _where the
generality comes from_: the platform, or a coincidence between two of
our apps.

Anything app-specific — ledgers, overrides, manifests, domain builders —
stays in its app.
