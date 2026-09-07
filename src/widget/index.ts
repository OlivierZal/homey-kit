/**
 * The widget-SDK surface: the promise-native transport, and the
 * freshness orchestrator every widget runs before its own init.
 * @packageDocumentation
 */
export {
  type WidgetApi,
  homeyApiGet,
  homeyApiPost,
  homeyApiPut,
} from './promise-api.ts'
export {
  type WidgetFreshnessHost,
  watchWidgetFreshness,
} from './watch-widget-freshness.ts'
