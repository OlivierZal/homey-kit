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

| Import                           | Contents                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `@olivierzal/homey-kit`          | `fireAndForget` (+ `Logger`), `getErrorMessage`, `NotFoundError`, `sequential`                                                |
| `@olivierzal/homey-kit/webview`  | `createDirtyGate` (exclusive arming: baseline or predicate), `watchWebviewFreshness`, `ensureFreshWebview`, `getPageIdentity` |
| `@olivierzal/homey-kit/settings` | The error-first-callback settings SDK promisified: `homeyApiGet`/`Post`/`Put`/`Delete`, `homeyConfirm`                        |
| `@olivierzal/homey-kit/node`     | `getWebviewHashes` — the packaged `webview-hashes.json` reader the freshness route serves                                     |
| `@olivierzal/homey-kit/types`    | `TypedManagerDrivers`, `TypedManagerSettings` — generics for the app's `homey` augmentation                                   |
| `@olivierzal/homey-kit/testing`  | `createApiContractSuite`, `createRouteGuardSuite` and their analysis seams (vitest peer)                                      |

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

## What belongs here

A module enters the kit when it is identical in at least two apps, has
been stable for a full cycle, and carries no hidden coupling to a Homey
SDK version. Anything app-specific — ledgers, overrides, manifests —
stays in its app.
