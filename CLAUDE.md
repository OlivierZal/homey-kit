# CLAUDE.md

Shared Homey runtime for the OlivierZal apps (`com.melcloud`,
`com.heatzy`, `com.melcloud.extension`), published to GitHub Packages
and pinned EXACTLY by every consumer — adoption is a reviewed PR per
release, never a range. ESM only, Node >= 22.19.

## Commands

Run the FULL suite before any push; check real exit codes:

- `npm run format` / `npm run format:fix` — prettier (preset from
  `@olivierzal/configs/prettier`).
- `npm run lint` / `npm run lint:fix` — ESLint over the
  `@olivierzal/configs` library preset plus this repo's overlays (the
  webview floor restated until configs exports its floor block
  standalone; the peer-import allowance for `src/settings` and
  `src/testing`).
- `npm run typecheck` — tsc (TypeScript 7 via `@typescript/native`).
- `npm test` / `npm run test:coverage` — vitest; thresholds are 100 %
  everywhere. `src/testing/**` is excluded from coverage as shipped
  test infrastructure: the generated suites exercise it, and the
  analysis seams (`analyzeRouteGuards`, `findContractBreach`) are
  pinned directly.
- `npm run lint:package` — build + `publint --strict`.

## Doctrine

- **Boundary of the kit**: a module enters when it is identical in ≥ 2
  apps, stable for a full cycle, and free of hidden Homey-SDK version
  coupling. App-specific ledgers, overrides and manifests stay in their
  app. No native-Homey behavior overrides.
- **Webview floor es2023** on `src/webview` and `src/settings`: these
  modules bundle into phone webviews — no `Object.groupBy`, no iterator
  helpers, no `v` regex flag.
- The dirty-gate contract is exclusive-arming (baseline XOR predicate);
  `serialize` stays a PURE snapshot in baseline mode. The freshness
  handshake refetches through a never-cached address, one attempt per
  identity, every failure path open.
- The test kernels are table-driven: consumers own their tables, this
  package owns everything below them. A kernel change here reaches the
  apps only through a release + adoption train.
- Family process applies: Conventional Commits PR titles (squash, the
  title IS the commit), CI green + Copilot threads resolved before
  merge, Sonar zero everywhere if wired (issues and duplication, new
  and overall alike), publish via GitHub Release → `publish.yml`
  (GitHub Packages, provenance-attested).
