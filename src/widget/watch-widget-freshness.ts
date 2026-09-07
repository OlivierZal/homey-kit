/**
 * The widgets' freshness orchestrator, the twin of the settings pages':
 * the same three routes — the served hashes, the boot-error breadcrumb
 * channel and the app's poke — over the promise-native widget transport,
 * so the handshake is one call per widget entry instead of a hand-written
 * triplet.
 * @packageDocumentation
 */
import { fireAndForget } from '../webview/boot.ts'
import { watchWebviewFreshness } from '../webview/webview-freshness.ts'
import { type WidgetApi, homeyApiGet, homeyApiPost } from './promise-api.ts'

/**
 * The widget SDK members the handshake uses: the transport and the
 * realtime-event subscription the app's poke arrives on. Described
 * structurally, like {@link WidgetApi}: the real `HomeyWidget` fits.
 * @category Widget
 */
export interface WidgetFreshnessHost extends WidgetApi {
  /**
   * The SDK's realtime-event subscription; the handshake registers its
   * re-check on `webview_hashes_changed`.
   */
  readonly on: (event: string, listener: () => void) => void
}

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
  homey: WidgetFreshnessHost,
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
    subscribe: (onPoke) => {
      homey.on('webview_hashes_changed', onPoke)
    },
  })
