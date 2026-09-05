/**
 * The settings pages' freshness orchestrator, single-sourced: every
 * consuming app wires `watchWebviewFreshness` to the same three routes —
 * the served hashes, the boot-error breadcrumb channel and the app's
 * poke — so the whole handshake is one call here instead of a
 * hand-written triplet per app.
 * @packageDocumentation
 */
import type Homey from 'homey/lib/HomeySettings.js'

import { watchWebviewFreshness } from '../webview/webview-freshness.ts'
import { homeyApiGet } from './callback-api.ts'

/**
 * Boot check plus the triggers that cover a page outliving it: a mobile
 * settings webview survives an app restart, so no new document — and no
 * boot check — ever happens there. Breadcrumbs ride the declared
 * boot-error route (`POST /boot-error`); a missed one is acceptable, so
 * the callback swallows the outcome.
 * @param homey - The settings SDK handle.
 * @returns Whether the boot check issued a refetch — the caller must then skip its own init: the document is about to be replaced.
 * @category Settings
 */
export const watchSettingsFreshness = async (homey: Homey): Promise<boolean> =>
  watchWebviewFreshness({
    entry: 'settings',
    fetchHashes: async () => homeyApiGet(homey, '/webview-hashes'),
    report: (message) => {
      homey.api(
        'POST',
        '/boot-error',
        { message, name: 'WebviewFreshness' },
        () => {
          // A missed freshness breadcrumb is acceptable.
        },
      )
    },
    subscribe: (onPoke) => {
      homey.on('webview_hashes_changed', onPoke)
    },
  })
