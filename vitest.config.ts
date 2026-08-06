import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      // src/testing is a shipped test harness — exercised by the
      // generated suites above, excluded from thresholds like the rest
      // of the family's test infrastructure.
      exclude: ['src/testing/**'],
      include: ['src/**/*.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    include: ['tests/**/*.test.ts'],
  },
})

export default config
