// @ts-check
import { typedocBase } from '@olivierzal/configs/typedoc'

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
  ...typedocBase({
    categoryOrder: [
      'Webview',
      'Settings',
      'Node',
      'Testing',
      'Types',
      'Utilities',
      'Errors',
    ],
    hostedBaseUrl: 'https://olivierzal.github.io/homey-kit/',
    name: 'Homey Kit',
    navigationLinks: { GitHub: 'https://github.com/OlivierZal/homey-kit' },
  }),
  // The base assumes the single-barrel library shape; the kit publishes
  // one entry per subpath, mirroring its `exports` map.
  entryPoints: [
    'src/index.ts',
    'src/node/webview-hashes.ts',
    'src/settings/callback-api.ts',
    'src/testing/index.ts',
    'src/types/homey.ts',
    'src/webview/index.ts',
  ],
}

export default config
