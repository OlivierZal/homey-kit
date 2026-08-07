/**
 * Cross-surface helpers every consuming app shares: error plumbing, the
 * fire-and-forget seam, sequential iteration and changelog selection.
 * @packageDocumentation
 */
export {
  type ChangelogEntry,
  type ChangelogSelection,
  type ChangelogSelectionOptions,
  selectChangelogEntries,
} from './changelog.ts'
export { NotFoundError } from './errors.ts'
export { type Logger, fireAndForget } from './fire-and-forget.ts'
export { getErrorMessage } from './get-error-message.ts'
export { sequential } from './sequential.ts'
