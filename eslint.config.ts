import type { Config } from 'eslint/config'
import { library } from '@olivierzal/configs/eslint'

// The webview modules ship into phone webviews whose engines stall at
// es2023: no `Object.groupBy`/`Map.groupBy`, no iterator helpers, no
// `v` regex flag. Restated here until @olivierzal/configs exports its
// floor block standalone (today it only ships inside the homey-app
// preset, whose other blocks are app-shaped).
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
  {
    files: WEBVIEW_FLOOR_FILES,
    rules: {
      'no-restricted-properties': [
        'error',
        {
          message: 'es2024 static — the webview floor is es2023.',
          object: 'Object',
          property: 'groupBy',
        },
        {
          message: 'es2024 static — the webview floor is es2023.',
          object: 'Map',
          property: 'groupBy',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          message:
            'The `v` regex flag is es2024 — the webview floor is es2023.',
          selector: 'Literal[regex.flags=/v/]',
        },
        {
          message: 'Iterator helpers are es2025 — the webview floor is es2023.',
          selector:
            'CallExpression[callee.property.name=/^(?:drop|every|filter|find|flatMap|forEach|map|reduce|some|take|toArray)$/][callee.object.callee.property.name=/^(?:entries|keys|values|matchAll)$/]',
        },
      ],
      'require-unicode-regexp': ['error', { requireFlag: 'u' }],
    },
  },
]

export default config
