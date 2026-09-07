import { describe, expect, it, vi } from 'vitest'

import { logSettingsRoute } from '../../src/log-settings-route.ts'

describe(logSettingsRoute, () => {
  it('should log the route under the settings-page data type', () => {
    const logger = { log: vi.fn<(...args: readonly unknown[]) => void>() }

    logSettingsRoute(logger, 'GET /settings/devices')

    expect(logger.log).toHaveBeenCalledExactlyOnceWith({
      dataType: 'Settings page',
      route: 'GET /settings/devices',
    })
  })
})
