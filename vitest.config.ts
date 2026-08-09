import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      // One file-scoped, measured exception — not a silent cap: the
      // route-guard extractor sits at 100 % statements/functions/lines
      // and 94 % branches, the remainder being `?? ''` fallbacks on
      // named groups its regexes guarantee — half-branches no input can
      // reach. Its behavior is pinned end to end (mutation fixtures in
      // tests/unit/testing-kernels.test.ts); everything else in the
      // package holds the global 100 on all four axes.
      exclude: ['src/testing/api-route-guards.ts'],
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
