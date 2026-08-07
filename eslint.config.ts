import type { Config } from 'eslint/config'
import { library, webviewFloorBlock } from '@olivierzal/configs/eslint'

// The webview modules ship into phone webviews whose engines stall at
// es2023. The floor itself comes from the shared fragment the Homey
// preset applies, so it cannot drift from what the apps enforce.
const WEBVIEW_FLOOR_FILES = [
  'src/dom/**/*.ts',
  'src/settings/**/*.ts',
  'src/webview/**/*.ts',
]

const config: Config[] = [
  // tests/fixtures holds TEXT the kernels read, not code.
  { ignores: ['coverage/', 'dist/', 'tests/fixtures/'] },
  ...library(),
  {
    // These two subpaths reach outside the package on purpose, and the
    // package declares NOTHING to satisfy them: naming `vitest` or the
    // homey types as a peer would install them on the device, since the
    // apps depend on this package in production. Both come from the
    // consumer, which has them as devDependencies — `./testing` runs
    // inside the consumer's vitest process, `./settings` types against
    // its aliased homey SDK.
    files: ['src/settings/**/*.ts', 'src/testing/**/*.ts'],
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        { devDependencies: true, peerDependencies: false },
      ],
    },
  },
  webviewFloorBlock(WEBVIEW_FLOOR_FILES),
]

export default config
