import { coverageDefaults } from '@olivierzal/configs/vitest-coverage'
import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    clearMocks: true,
    coverage: { ...coverageDefaults, include: ['src/**/*.ts'] },
    include: ['tests/**/*.test.ts'],
  },
})

export default config
