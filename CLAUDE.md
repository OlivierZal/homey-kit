# CLAUDE.md

Shared Homey runtime for the OlivierZal apps (`com.melcloud`,
`com.heatzy`, `com.melcloud.extension`), published to GitHub Packages
and pinned EXACTLY by every consumer — adoption is a reviewed PR per
release, never a range. ESM only, Node >= 22.20 — the measured device
floor, which development tracks too; what SHIPS is bounded further by
where each module runs (see the floors below).

The README speaks to the package's CONSUMER (install, subpaths, wiring
examples); this file speaks to its MAINTAINER. Doctrine evolves HERE
first — a rule stated in both files must say the same thing, and the
README carries at most a one-line pointer at it.

## Commands

Run the FULL suite before any push; check real exit codes:

- `npm run build` — purges `dist` before emitting, because `tsc` overwrites
  but never deletes: a module renamed or removed in `src` would otherwise
  survive in `dist`, and `files` ships that directory, so `prepare` would
  pack the fossil. The purge is inline rather than a `prebuild` hook so it
  cannot be skipped with `--ignore-scripts`.
- `npm run format` / `npm run format:fix` — prettier (preset from
  `@olivierzal/configs/prettier`, wired through the package.json
  `prettier` key like the rest of the family).
- `npm run lint` / `npm run lint:fix` — ESLint over the
  `@olivierzal/configs` library preset plus this repo's overlays: the
  webview floor composed from the preset's `webviewFloorBlock`, and the
  dev-import allowance for `src/settings` and `src/testing` (they
  import what consumers hold as devDependencies).
- `npm run typecheck` — the native TypeScript 7 compiler, reached by its
  explicit path (`node ./node_modules/@typescript/native/bin/tsc`). A
  bare `tsc` is NOT the same compiler: under the official 6/7 layout the
  `.bin/tsc` shim belongs to `@typescript/old`, the TS6 the compat
  package depends on, so it silently typechecks with TypeScript 6 — the
  native 7.x ships no shim at all, and `tsc6` is that same TS6. Only the
  explicit path holds.
- `npm test` / `npm run test:coverage` — vitest; thresholds are 100 %
  on all four axes, over the whole of `src/` with no exception. A
  fallback TypeScript demands on a read no input reaches is closed by
  restructuring, never by a coverage directive (the kit carries none):
  a guaranteed regex group reads through `namedGroup`, which throws
  where the fallback would have handed a sweep an empty path to count
  as read.
- `npm run docs` — typedoc; the Pages site deploys on release
  (environment `github-pages` allows `v*` tags — a branch-only policy
  once broke four consecutive deploys silently).
- `npm run lint:package` — build + `publint --strict`.

## What enters the kit — two bars

**Our own code** enters when it is identical in at least two apps,
stable for a full cycle, and free of hidden Homey-SDK version coupling.
Two consumers are the evidence: one app's helper is one app's opinion,
and hoisting it early freezes a shape nothing has tested against a
second set of needs.

**Homey's platform surface** enters at one consumer: the SDK transports
(`./settings`, `./widget`), the `homey-form-*` markup (`./dom`), the
boot cycle, the manifest readers. Its generality comes from the
platform, not from our usage — a second app would rediscover the same
API because the platform hands it the same API, and waiting for that
rediscovery only buys a divergent second implementation (the three
spellings of the same element accessor were exactly that).

"It looks generic" is not the test — it is available as an argument for
anything. The test is where the shape comes from: the platform, or a
single app's taste. App-specific ledgers, overrides and manifests stay
in their app; no native-Homey behavior overrides.

**Layered exports are deliberate, not ghosts**: `ensureFreshWebview`
under `watchWebviewFreshness`, `withInitTimeout` under `runWebview`,
`getPageIdentity` beside both, `configureNumericInput` under
`createInput`. The orchestrator is the documented path; the primitive
stays public for a consumer that owns the orchestration. Do not remove
a primitive because only the orchestrator calls it today.

## No dependencies, and no peers either

The package declares nothing, deliberately. The apps install it as a
PRODUCTION dependency (the `./node` subpath runs on the device), so
anything it names ships to the device: a `vitest` peer — optional or
not — once put 39 packages and 39 MB of test framework and bundlers
onto a Homey, vulnerabilities included. Optional peers do not save you:
the consumer's lockfile records the link, and `npm ci --omit=dev`
installs it. The two subpaths that need an outside package import what
every consumer already holds as a devDependency (`./testing` →
`vitest`, `./settings` → the `homey` types via the apps' `@types/homey`
alias), and a missing one fails loudly at its own call site, in a dev
context, which is the right place to learn it.

`./testing` therefore rides to the device unused, and that is ACCEPTED —
measured, 2026-08: `dist/testing` is 64 KB installed, against a ~10 MB
production tree, so under 1 %. Splitting it into a second package is the
only way to shed it, and the cure is worse: the kernels pin the runtime
they exercise, so two packages could drift into testing a version that
is not the one shipping. `src` ships for the same accepted-cost reason —
the 20 `.d.ts.map`/`.js.map` pairs resolve into it, which is what makes
go-to-definition land on real source.

## Runtime floors

- **Webview floor (es2023 APIs, `u` regexes)** on every module a
  webview bundle can reach: `src/webview`, `src/settings`, `src/dom`,
  `src/widget`, and every flat root module — the root barrel is
  cross-surface by contract, and the apps do bundle from it
  (`getErrorMessage` sits in com.melcloud's shipped settings bundle,
  measured 2026-08 by metafile after it had escaped the narrower
  perimeter). A module that needs node-only freedom belongs under a
  node-only subpath, never the root barrel. esbuild lowers syntax
  only, and the worst engine is not hypothetical: the Homey mobile
  app's iOS 16.4 App Store minimum (read 2026-08-11) is what derives
  the es2023 ceiling.
  Composed from the configs preset's `webviewFloorBlock` — never
  re-derive it by hand: the hand copy this repo once carried had
  drifted in BOTH directions (missed `matchAll`, false-positived
  `Object.entries().map()`).
- **Device node runtime — measured, no API floor**: the fleet
  measurement (2026-08) put every up-to-date device at Node 22.20
  (Pro Early 2019) or 22.23 (Pro 2023), which is what `engines.node`
  declares — a floor stated from where this code RUNS, never from what
  a dependency happens to require. No API ban-list exists: the 100 %
  coverage bar makes every shipped line execute under that Node in CI,
  which is the enforcement. The 2016-2019 crash
  was a firmware gap and is closed; what it surfaced is not. REGEXES IN
  THE FLOOR PERIMETER STAY `u` — the modules above ship into phone
  WebKits as old as iOS 16.4's (the Homey app's App Store minimum,
  read 2026-08-11), which predate the es2024 `v` flag; under the apps'
  sub-es2024 esbuild target an escapee ships as a `new RegExp` call
  and throws at runtime inside the feature that runs it, and no Homey
  update rejuvenates those engines — the App Store minimum reaching
  17.4 is what re-opens es2024. Node-side modules take the family
  default (`v`); the step-down is `webviewFloorBlock`'s job alone,
  never a second overlay.
- `src/testing` is dev-only (runs on the developer's Node) and exempt
  from both floors — which is why its extractors may build `v`-flag
  regexes.

## Freshness doctrine — measured, not assumed

The self-heal guarantee lives in the BOOT check: a new document checks
itself. Surfaces that remount their page are fresh for free — the Homey
web app tears the settings page down during an app restart ("app
unavailable", then remount), and the mobile dashboard remounts its
widgets. The ONE surface with no remount is a mobile settings webview
left open across an app restart: no new document, no boot check —
that is what the foreground (visibilitychange) trigger exists for.

The app's `webview_hashes_changed` poke guarantees nothing on its own:
it is emitted at the end of the app's `onInit`, i.e. at the instant the
restart has just disconnected every open page, so its audience is
absent by construction — measured on-device, an open page produced no
hash call and no breadcrumb. It is kept because it costs nothing where
it does arrive. NEVER fold the foreground trigger into it.

Every call leaving `webview-freshness.ts` and `boot.ts` is fenced call
by call — caller sinks (`report`, `subscribe`, `onError`, `height`),
page APIs, storage — so each degradation is reachable by a test; no
catch-all wrappers (an unreachable filet is untestable dead code, and
the 100 % bar rejects it rightly). One refetch per identity, through a
never-cached address; denied storage skips the refetch rather than risk
a boot-navigation livelock. A throwing `report` sink once cost the
navigation itself (the breadcrumb fired before the refetch): sinks are
fenced FIRST for that reason.

## Contracts worth restating

- The dirty-gate contract is exclusive-arming (baseline XOR predicate);
  `serialize` stays a PURE snapshot in baseline mode.
- `getWebviewHashes` REQUIRES the manifest URL: an inferred default
  once resolved inside `node_modules`, failed open and silently
  disabled the handshake. A module built to defeat stale caches holds
  no cache of its own (nothing is memoised).
- The test kernels are analysis SEAMS (`findContractBreach`,
  `analyzeRouteGuards`); each app declares its own `describe`/`it` over
  them — suite factories that declared the tests package-side made
  every consumer test file read as empty (Sonar S2187) and were
  removed. A kernel change here reaches the apps only through a
  release + adoption train.
- `NotFoundError`: the extension keeps a LOCAL variant that forces
  `super('notFound')` because its settings UI matches on that message —
  never "deduplicate" it blindly.

## Governance files

`SECURITY.md` and `CONTRIBUTING.md` exist here because this package is a
public npm artifact whose code runs on end-user hardware — the reporting
path and the local workflow have to be written down, not inferred from a
sibling repo. The security policy states the distinction triage needs:
unlike the tooling repos, a vulnerability here reaches devices.

There is deliberately **no `CHANGELOG.md`**: the changelog channel is the
GitHub release notes, written around what a consuming app must do to
adopt the release. That is a verdict, not an omission — a second
file-based history would duplicate the content and let the two drift. The
obligation it carries is that the notes stay substantial; a channel
nobody keeps is not a channel.

`.github/dependabot.yml` carries `cooldown: default-days: 7` on both
update entries, as the seven sibling repos do — all eight carry it,
counted 2026-08-30; the figure read six until `api-core` joined the
family. Without it an automatic bump
can catch a compromised package inside the window between publication and
withdrawal (`zizmor/dependabot-cooldown`). This repo simply never received
it at creation — the same omission as the two governance files.

## Process

Family process applies: Conventional Commits PR titles (squash, the
title IS the commit), CI green + Copilot threads resolved before merge,
Sonar zero on BOTH windows verified BEFORE merge (issues and
duplication, new and overall alike), publish via GitHub Release →
`publish.yml` (GitHub Packages, provenance-attested), registry proven
by `npm view` before any "published" claim. Version by the CONTRACT,
not by observed consumers: a signature change is a major even when
every known caller already complies.

Dependabot's commit prefixes are pinned to `build(deps)` /
`build(deps-dev)` — including the `github-actions` entry, which said
`ci` until 2026-08 purely because this repo was created without the
family template. The **subject** casing cannot be pinned:
`commit-message` accepts only `prefix`, `prefix-development` and
`include`, so Dependabot keeps matching each repo's own history. Left
alone by decision — a Dependabot commit subject is not a contract, the
PR title is, and the `PR title` check already holds that one.
