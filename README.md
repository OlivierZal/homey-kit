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

| Import                           | Contents                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@olivierzal/homey-kit`          | `fireAndForget` (+ `Logger`), `getErrorMessage`, `NotFoundError`, `sequential`                         |
| `@olivierzal/homey-kit/webview`  | `createDirtyGate` (exclusive arming: baseline or predicate), `ensureFreshWebview`                      |
| `@olivierzal/homey-kit/settings` | The error-first-callback settings SDK promisified: `homeyApiGet`/`Post`/`Put`/`Delete`, `homeyConfirm` |
| `@olivierzal/homey-kit/node`     | `getWebviewHashes` — the packaged `webview-hashes.json` reader the freshness route serves              |
| `@olivierzal/homey-kit/types`    | `TypedManagerDrivers`, `TypedManagerSettings` — generics for the app's `homey` augmentation            |
| `@olivierzal/homey-kit/testing`  | `createApiContractSuite`, `createRouteGuardSuite` and their analysis seams (vitest peer)               |

## Wiring the type augmentations

Module augmentation cannot ship in a package; each app keeps a local
`homey-override.d.ts` and extends the generics:

```ts title="homey-override"
import type {
  TypedManagerDrivers,
  TypedManagerSettings,
} from '@olivierzal/homey-kit/types'
import type MyApp from './app.mts'
import type { HomeySettings } from './types.mts'
import type { MyDriver } from './types.mts'

declare module 'homey' {
  interface Homey {
    app: MyApp
  }
  interface ManagerDrivers extends TypedManagerDrivers<MyDriver> {}
  interface ManagerSettings extends TypedManagerSettings<HomeySettings> {}
}
```

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

## What belongs here

A module enters the kit when it is identical in at least two apps, has
been stable for a full cycle, and carries no hidden coupling to a Homey
SDK version. Anything app-specific — ledgers, overrides, manifests —
stays in its app.
