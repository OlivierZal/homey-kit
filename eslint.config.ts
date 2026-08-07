import type { Config } from 'eslint/config'
import { library, webviewFloorBlock } from '@olivierzal/configs/eslint'

// The webview modules ship into phone webviews whose engines stall at
// es2023. The floor itself comes from the shared fragment the Homey
// preset applies, so it cannot drift from what the apps enforce.
const WEBVIEW_FLOOR_FILES = ['src/settings/**/*.ts', 'src/webview/**/*.ts']

const config: Config[] = [
  // tests/fixtures holds TEXT the kernels read, not code.
  { ignores: ['coverage/', 'dist/', 'tests/fixtures/'] },
  ...library(),
  {
    // src/testing imports its optional peer (vitest): the suites it
    // generates run inside the consumer's vitest process. The settings
    // transport types against the homey SDK peer the same way.
    files: ['src/settings/**/*.ts', 'src/testing/**/*.ts'],
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        { devDependencies: false, peerDependencies: true },
      ],
    },
  },
  webviewFloorBlock(WEBVIEW_FLOOR_FILES),
]

export default config
