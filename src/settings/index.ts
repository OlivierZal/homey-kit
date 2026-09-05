/**
 * The settings-SDK surface: the promise-native transport over the SDK's
 * error-first callbacks, and the freshness orchestrator every settings
 * page runs before its own init.
 * @packageDocumentation
 */
export {
  homeyApiDelete,
  homeyApiGet,
  homeyApiPost,
  homeyApiPut,
  homeyCallback,
  homeyConfirm,
} from './callback-api.ts'
export { watchSettingsFreshness } from './watch-settings-freshness.ts'
