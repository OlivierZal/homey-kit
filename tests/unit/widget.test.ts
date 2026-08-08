import { describe, expect, it, vi } from 'vitest'

import {
  type WidgetApi,
  homeyApiGet,
  homeyApiPost,
  homeyApiPut,
} from '../../src/widget/index.ts'

const mockHomey = (response?: unknown): WidgetApi => ({
  api: vi.fn<WidgetApi['api']>().mockResolvedValue(response),
})

describe('the widget transport', () => {
  it('reads a route and hands back its response', async () => {
    const homey = mockHomey({ power: true })

    await expect(homeyApiGet(homey, '/devices')).resolves.toStrictEqual({
      power: true,
    })
    expect(homey.api).toHaveBeenCalledWith('GET', '/devices')
  })

  it('posts a body', async () => {
    const homey = mockHomey()

    await homeyApiPost(homey, '/sessions', { username: 'a' })

    expect(homey.api).toHaveBeenCalledWith('POST', '/sessions', {
      username: 'a',
    })
  })

  it('puts a body', async () => {
    const homey = mockHomey()

    await homeyApiPut(homey, '/devices', { power: false })

    expect(homey.api).toHaveBeenCalledWith('PUT', '/devices', { power: false })
  })

  it('propagates a transport rejection', async () => {
    const homey: WidgetApi = {
      api: vi.fn<WidgetApi['api']>().mockRejectedValue(new Error('offline')),
    }

    await expect(homeyApiGet(homey, '/devices')).rejects.toThrow('offline')
  })
})
