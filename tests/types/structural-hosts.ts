/**
 * Compile-time guards over the structural host types the root and
 * widget helpers take: each resolves to `false` the moment the real SDK
 * instance — or an app's `TypedManagerSettings`-augmented store — stops
 * fitting, and assigning `true` to `false` stops `tsc`. Checked by
 * `typecheck`, not by the test run: the types erase.
 */
import type HomeyLib from 'homey/lib/Homey.js'
import type HomeyWidget from 'homey/lib/HomeyWidget.js'

import type { ChangelogAnnouncementOptions } from '../../src/announce-changelog.ts'
import type { SettingStore } from '../../src/setting-manager.ts'
import type { TypedManagerSettings } from '../../src/types/homey.ts'
import type { WidgetFreshnessHost } from '../../src/widget/watch-widget-freshness.ts'

interface TestSettings {
  readonly homeUsername?: string | null
  readonly notifiedVersion?: string | null
  readonly username?: string | null
}

// The widget SDK instance is the freshness host as-is: its `api`
// narrows the method to four literals (bivariant method signature) and
// its `on` takes a `Function`.
export const canWidgetHost: HomeyWidget extends WidgetFreshnessHost
  ? true
  : false = true

// The Homey instance is the scheduler as-is — its `this`-bound,
// uninit-tracked `setTimeout` takes a `Function`.
export const canHomeySchedule: HomeyLib extends ChangelogAnnouncementOptions['homey']
  ? true
  : false = true

export const canNotificationsPost: HomeyLib['notifications'] extends ChangelogAnnouncementOptions['notifications']
  ? true
  : false = true

// An app's augmented settings — keyed by its own names, never `string` —
// fit both hosts without the widening the augmentation refuses.
export const canSettingsAnnounce: TypedManagerSettings<TestSettings> extends ChangelogAnnouncementOptions['settings']
  ? true
  : false = true

export const canSettingsStore: TypedManagerSettings<TestSettings> extends SettingStore<
  keyof TestSettings
>
  ? true
  : false = true

// A `string`-keyed store is NOT what the typed manager presents: the
// adapter's mapper is the one narrowing, and it stays app-side.
export const isStoreNarrow: TypedManagerSettings<TestSettings> extends SettingStore<string>
  ? false
  : true = true
