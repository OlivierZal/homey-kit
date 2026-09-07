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
  on all four axes (the family's `coverageDefaults` fragment from
  `@olivierzal/configs/vitest-coverage`, which also fixes the
  reporters; only the `include` glob is this repo's), over the whole of
  `src/` with no exception. A
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
under `watchWebviewFreshness`, itself under `watchSettingsFreshness`
(the settings page's fixed routes) and `watchWidgetFreshness` (the same
routes over the widget transport), `withInitTimeout` under
`runWebview`, `getPageIdentity` beside both, `configureNumericInput`
under `createInput`, `stampHtml`/`stampReferences` under
`stampPackagedPages`, `selectChangelogEntries` under
`announceChangelog`. The orchestrator is the documented path; the
primitive stays public for a consumer that owns the orchestration. Do
not remove a primitive because only the orchestrator calls it today.

The 5.2.0 root helpers entered on the first bar — `announceChangelog`
and `logSettingsRoute` were verbatim in three apps, `createSettingManager`
and `settleAll` in two — and `watchWidgetFreshness` on the second (one
consumer; the shape is the SDK transport's, and it is line for line the
settings orchestrator with the other transport).

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

The bare `homey-apps-sdk-v3-types` devDependency beside the
`@types/homey` alias is NOT a leftover of the dropped peer, and the two
lines move together on every SDK-types bump. The alias is what lets
`homey/lib/…` resolve for TypeScript; the bare name is what satisfies
`import-x/no-extraneous-dependencies`, which checks the RESOLVED
package's real `name` against the manifest and never maps `homey` to
`@types/homey` — and the library preset runs it with `includeTypes:
true`, so the two settings tests' `import type … from
'homey/lib/HomeySettings.js'` need the bare name declared (measured
2026-09-06: removing it fails lint on exactly those two files, and
nothing else — typecheck, tests and build all still pass, which is why
it reads as dead to a grep).

`./testing` therefore rides to the device unused, and that is ACCEPTED —
re-measured 2026-09-06, after #72 hoisted the helpers and the floor
kernel into it: `dist/testing` is 48 KB apparent (104 KB in 4 KB
blocks) against a production tree of roughly 10 MB (measured 2026-08),
so about 1 % at worst. Splitting it into a second package is the only way to
shed it, and the cure is worse: the kernels pin the runtime they
exercise, so two packages could drift into testing a version that is
not the one shipping. `src` ships for the same accepted-cost reason —
every `.d.ts.map`/`.js.map` pair (one per `src` module, so the count
moves with each hoist) resolves into it, which is what makes
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
- `createSettingManager` has NO identity default for its mapper: a
  `string`-keyed store would be the escape hatch `TypedManagerSettings`
  refuses, and no consumer reaches such a default — each app keeps its
  `prefixKey`/`settingKey` narrowing, with its boundary comment, beside
  its own settings type. A default nothing reaches is the kind of branch
  the 100 % bar rejects (see `parseFormValue` below for the one such
  branch the contract keeps until the next major).
- `announceChangelog` takes the Homey instance as its scheduler (its
  `setTimeout` is `this`-bound and disposed at uninit — never hand it a
  bare `setTimeout`), owns the `notifiedVersion` key and the ten-second
  delay, and swallows a failed post so the version stays unrecorded for
  the next boot. The host halves are structural: the apps' augmented
  `homey.settings` fits without a `(key: string)` widening
  (`tests/types/structural-hosts.ts` pins that, together with the real
  `Homey`/`HomeyWidget` types against the scheduler and the widget host).
- `parseFormValue` KEEPS its `parseNumber` strategy parameter through
  5.x, and it is scheduled for removal in the next major — the 2026-09
  verdict on the "reached by no consumer" finding, corrected once by the
  dry adoptions. The draft verdict had the second reader (com.heatzy)
  adopt the reader WITH its bounded-number strategy, and it cannot:
  every device-setting control that page builds is a `<select>`
  (`createSelect` over `booleanOptions` or the manifest's dropdown ids),
  and the strategy branch opens only for a `type="number"` input
  carrying both bounds. com.melcloud's two call sites are
  single-argument, and its one page with bounded number inputs (the
  protection min/max pairs) applies its throwing, localized strategy to
  the input directly and clamps the pair on the write — the hook is
  bypassed by the only page that has such a strategy. So after 5.2.0
  the branch has NO consumer in the family: com.heatzy imports
  `parseFormValue(element)` plain and deletes its local `processValue`,
  which is the two-apps bar met for the READER, not for the strategy.
  Dropping the parameter is a `./dom` signature change — a major by
  the contract, whatever the callers pass — so it rides to 6.0.0; until
  then the kit's own tests keep the branch covered, and a consumer that
  needs a bounds strategy re-enters it with that consumer.
- `parseFormValue` reads numbers by VALUE, not by control: a `<select>`
  whose option ids are numeric strings reads as numbers (com.melcloud's
  temperature-grid select relies on it — never gate the coercion on
  `type === 'number'`), so a page whose dropdown ids are words on the
  wire keeps them words: a numeric-looking id would be written as a
  number the driver never declared and read as divergent from its
  stored value forever. Neither app is hit (com.heatzy's ids are
  `cft`/`eco`/`previous`, which its 5.2.0 adoption pins in
  `tests/unit/device-settings-contract.test.ts`; com.melcloud's composed
  manifest carries no numeric dropdown id, counted 2026-09-07). The
  constraint lives on the consumer's manifest; the kit states it beside
  the reader and the README carries the pointer.

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
