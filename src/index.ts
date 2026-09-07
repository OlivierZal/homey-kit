/**
 * Cross-surface helpers every consuming app shares: error plumbing, the
 * fire-and-forget and settle-all seams, sequential iteration, the
 * settings-page breadcrumb, the settings adapter and the changelog
 * announcement.
 * @packageDocumentation
 */
export {
  type ChangelogAnnouncementOptions,
  announceChangelog,
  NOTIFICATION_DELAY_MS,
} from './announce-changelog.ts'
export {
  type ChangelogEntry,
  type ChangelogSelection,
  type ChangelogSelectionOptions,
  selectChangelogEntries,
} from './changelog.ts'
export { NotFoundError } from './errors.ts'
export { type Logger, fireAndForget } from './fire-and-forget.ts'
export { getErrorMessage } from './get-error-message.ts'
export {
  type BreadcrumbLogger,
  logSettingsRoute,
} from './log-settings-route.ts'
export { sequential } from './sequential.ts'
export {
  type SettingManager,
  type SettingStore,
  createSettingManager,
} from './setting-manager.ts'
export { settleAll } from './settle-all.ts'
