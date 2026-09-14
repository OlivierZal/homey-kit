/**
 * The widgets' freshness orchestrator, the twin of the settings pages':
 * the same two routes — the served hashes and the boot-error breadcrumb
 * channel — over the promise-native widget transport, so the handshake
 * is one call per widget entry instead of a hand-written pair.
 * @packageDocumentation
 */
import { fireAndForget } from '../webview/boot.ts'
import { watchWebviewFreshness } from '../webview/webview-freshness.ts'
import { type WidgetApi, homeyApiGet, homeyApiPost } from './promise-api.ts'

/**
 * Boot check plus the triggers that cover a page outliving it, under
 * the widget's own entry key. Breadcrumbs ride the declared boot-error
 * route (`POST /boot-error`); a missed one is acceptable, so the post is
 * detached with a silent sink.
 * @param homey - The widget SDK instance.
 * @param entry - The widget's key in the served hash manifest.
 * @returns Whether the boot check issued a refetch — the caller must then skip its own init: the document is about to be replaced.
 * @category Widget
 */
export const watchWidgetFreshness = async (
  homey: WidgetApi,
  entry: string,
): Promise<boolean> =>
  watchWebviewFreshness({
    entry,
    fetchHashes: async () => homeyApiGet(homey, '/webview-hashes'),
    report: (message) => {
      fireAndForget(
        homeyApiPost(homey, '/boot-error', {
          message,
          name: 'WebviewFreshness',
        }),
        () => {
          // A missed freshness breadcrumb is acceptable.
        },
      )
    },
  })
