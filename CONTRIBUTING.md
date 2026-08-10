# Contributing

Thanks for considering a contribution. This document describes the local
workflow expected before opening a pull request.

## Prerequisites

- Node.js matching `engines.node` in [`package.json`](package.json) —
  currently `>=22.20.0`, the floor **measured on the device fleet**
  rather than a round number
- npm 10+
- A GitHub personal access token with the `read:packages` scope, exported
  as `NODE_AUTH_TOKEN` — [`.npmrc`](.npmrc) reads that variable to fetch
  the `@olivierzal/configs` development dependency

## Setup

```sh title="setup"
git clone https://github.com/OlivierZal/homey-kit.git
cd homey-kit
npm ci
```

## Local checks

Run the same suite CI runs on every pull request:

```sh title="checks"
npm run typecheck       # native tsc --noEmit
npm run lint            # ESLint with the shared library preset
npm run format          # prettier --check (npm run format:fix to write)
npm test                # vitest run
npm run test:coverage   # vitest run --coverage (must remain at 100%)
npm run docs            # typedoc
npm run lint:package    # build + publint --strict
```

`prepublishOnly` chains tests, typecheck, lint and format, so publishing
without them passing is impossible.

## Coverage

Branches, functions, lines and statements are all enforced at **100%** in
[`vitest.config.ts`](vitest.config.ts). New code must arrive with the
tests that keep those thresholds green.

## This package runs on the device

It is a **production dependency** of the Homey apps, so its published
output installs under `npm ci --omit=dev` and executes on real hardware.
Three habits follow:

- **Declare no runtime dependency.** Zero dependencies and zero peers is
  a deliberate property: an optional peer still lands in a consumer's
  production tree, and a measured regression once shipped 67 packages and
  73 MB to the device that way.
- **Two runtimes, two floors.** Node-side code follows `engines.node`.
  The `./dom`, `./settings` and `./webview` subpaths ship into phone
  webviews whose engines stall at **es2023** — a separate, lower ceiling
  the lint enforces on those paths. Raising one floor never raises the
  other; conflating them has already caused a production incident.
- **A change to a shared primitive is a release plus three adoptions.**
  Prefer the shape that keeps consumers working over the locally tidiest
  one, and say so in the pull request when the surface moves.

## Commits & pull requests

- **The pull request title is the commit that lands.** Squash merging is
  the only merge method and it takes the PR title, so the title must
  follow [Conventional Commits](https://www.conventionalcommits.org) —
  the required `PR title` check enforces it. Individual commit messages
  inside the branch are free-form.
- Keep pull requests focused: one concern each.
- **Companion docs are part of done.** A pull request that changes
  behaviour, the exported surface, a requirement or a process updates the
  affected companion files — [`README.md`](README.md),
  [`CLAUDE.md`](CLAUDE.md), this file, [`SECURITY.md`](SECURITY.md) — in
  the same pull request, never in a later sweep.
- Breaking changes: call them out explicitly in the description.

## Releases and the changelog

There is deliberately **no `CHANGELOG.md`** here. The changelog channel is
the GitHub release notes, written per release around what a consuming app
must do to adopt it. Keeping a second, file-based history would mean
maintaining the same content twice and letting the two drift.

Releases are cut by the maintainer through GitHub Releases; `publish.yml`
then publishes to GitHub Packages. Versions follow
[SemVer](https://semver.org), counted against what a consumer sees:
raising what the published output requires at runtime is breaking even
when no exported type moves.
