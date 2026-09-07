/**
 * The boot-time changelog announcement, single-sourced: read the
 * version last announced, select what the user has not been told about,
 * post it after the restart's own churn has settled, and remember the
 * running version — the wiring every consuming app carried by hand
 * around {@link selectChangelogEntries}.
 * @packageDocumentation
 */
import {
  type ChangelogSelectionOptions,
  selectChangelogEntries,
} from './changelog.ts'
import { sequential } from './sequential.ts'

/**
 * The delay before the announcement is posted: the app has just
 * started, and a notification landing inside the restart's own churn
 * reads as noise. Exported so a consuming suite advances its fake
 * timers by the same figure instead of restating it.
 * @category Changelog
 */
export const NOTIFICATION_DELAY_MS = 10_000

/**
 * Inputs to {@link announceChangelog}. The host halves are named
 * structurally, so the kit declares no SDK type: the app's
 * `homey.settings`, `homey.notifications` and `homey` itself fit.
 * @category Changelog
 */
export interface ChangelogAnnouncementOptions extends Pick<
  ChangelogSelectionOptions,
  'changelog' | 'language'
> {
  /**
   * The scheduler. Pass the Homey instance (its `setTimeout` is
   * `this`-bound and tracked for disposal at uninit, which a bare
   * `setTimeout` reference would lose) or a thunk bound to it.
   */
  readonly homey: {
    /**
     * Schedules the announcement; the callback never rejects.
     */
    readonly setTimeout: (callback: () => Promise<void>, ms: number) => unknown
  }
  /**
   * The notification channel — the SDK's `homey.notifications`.
   */
  readonly notifications: {
    /**
     * Posts one excerpt to the timeline.
     */
    readonly createNotification: (notification: {
      readonly excerpt: string
    }) => Promise<unknown>
  }
  /**
   * The store of the version last announced, under `notifiedVersion` —
   * the SDK's `homey.settings`, typed by the app's own keys.
   */
  readonly settings: {
    /**
     * Reads the version last announced; untyped, as every settings read is.
     */
    readonly get: (key: 'notifiedVersion') => unknown
    /**
     * Records the version just announced.
     */
    readonly set: (key: 'notifiedVersion', value: string) => void
  }
  /**
   * The running version — the manifest's.
   */
  readonly version: string
}

/**
 * Announces every version since the one already announced, not just the
 * running one, and records the running version once the announcement
 * posted. The stored value is untyped, as every settings read is:
 * anything but a string reads as no baseline at all — a first install.
 * Posting is best-effort: a notification that fails leaves the version
 * unrecorded, so the next boot tries again.
 * @param options - See {@link ChangelogAnnouncementOptions}.
 * @category Changelog
 */
export const announceChangelog = (
  options: ChangelogAnnouncementOptions,
): void => {
  const { changelog, homey, language, notifications, settings, version } =
    options
  const notified = settings.get('notifiedVersion')
  const { entries } = selectChangelogEntries({
    changelog,
    from: typeof notified === 'string' ? notified : null,
    language,
    to: version,
  })
  if (entries.length === 0) {
    return
  }
  homey.setTimeout(async () => {
    try {
      await sequential(entries, async ({ excerpt }) => {
        await notifications.createNotification({ excerpt })
      })
      settings.set('notifiedVersion', version)
    } catch {
      // Non-critical: notification display is best-effort.
    }
  }, NOTIFICATION_DELAY_MS)
}
