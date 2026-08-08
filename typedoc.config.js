// @ts-check
import { typedocBase } from '@olivierzal/configs/typedoc'

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = typedocBase({
  categoryOrder: [
    'Webview',
    'DOM',
    'Settings',
    'Manifest',
    'Node',
    'Changelog',
    'Testing',
    'Types',
    'Utilities',
    'Errors',
  ],
  // One entry per subpath, mirroring the `exports` map.
  entryPoints: [
    'src/index.ts',
    'src/dom/index.ts',
    'src/manifest/index.ts',
    'src/node/webview-hashes.ts',
    'src/settings/callback-api.ts',
    'src/testing/index.ts',
    'src/types/homey.ts',
    'src/webview/index.ts',
    'src/widget/index.ts',
  ],
  hostedBaseUrl: 'https://olivierzal.github.io/homey-kit/',
  name: 'Homey Kit',
  navigationLinks: { GitHub: 'https://github.com/OlivierZal/homey-kit' },
})

export default config
