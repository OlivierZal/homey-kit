import type Homey from 'homey/lib/HomeySettings.js'
import { describe, expect, it, vi } from 'vitest'

import {
  homeyApiDelete,
  homeyApiGet,
  homeyApiPost,
  homeyApiPut,
  homeyCallback,
  homeyConfirm,
} from '../../src/settings/callback-api.ts'
import { mock } from '../helpers.ts'

type ErrorFirst = (error: Error | null, result: unknown) => void

type SdkApi = (
  ...args: [method: string, path: string, third: unknown, fourth?: unknown]
) => void

type SdkConfirm = (
  message: string,
  icon: null,
  callback: (confirmError: Error | null, value: boolean) => void,
) => void

const isCallback = (value: unknown): value is ErrorFirst =>
  typeof value === 'function'

// The settings SDK double: `api`/`confirm` invoke their error-first
// callback synchronously with whatever the test seeds. The callback
// sits third on body-less verbs and fourth otherwise.
const createHomey = ({
  error = null,
  result,
}: { error?: Error | null; result?: unknown } = {}): {
  api: ReturnType<typeof vi.fn<SdkApi>>
  confirm: ReturnType<typeof vi.fn<SdkConfirm>>
  homey: Homey
} => {
  const api = vi.fn<SdkApi>((...args) => {
    const callback = isCallback(args[3]) ? args[3] : args[2]
    if (isCallback(callback)) {
      callback(error, result)
    }
  })
  const confirm = vi.fn<SdkConfirm>((_message, _icon, callback) => {
    callback(error, result === true)
  })
  return { api, confirm, homey: mock<Homey>({ api, confirm }) }
}

describe('callback api', () => {
  it('should resolve the promisified callback with its result', async () => {
    await expect(
      homeyCallback<string>((callback) => {
        callback(null, 'value')
      }),
    ).resolves.toBe('value')
  })

  it('should reject the promisified callback with its error', async () => {
    await expect(
      homeyCallback<undefined>((callback) => {
        callback(new Error('denied'), undefined)
      }),
    ).rejects.toThrow('denied')
  })

  it('should route each verb wrapper through the SDK api', async () => {
    const { api, homey } = createHomey({ result: 'payload' })
    const bare = createHomey()

    await expect(homeyApiGet(homey, '/path')).resolves.toBe('payload')
    await expect(homeyApiPost(homey, '/path', { body: 1 })).resolves.toBe(
      'payload',
    )
    await expect(homeyApiPut(homey, '/path', { body: 2 })).resolves.toBe(
      'payload',
    )
    await expect(homeyApiDelete(bare.homey, '/path')).resolves.toBeUndefined()

    expect(api).toHaveBeenNthCalledWith(1, 'GET', '/path', expect.any(Function))
    expect(api).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/path',
      { body: 1 },
      expect.any(Function),
    )
    expect(api).toHaveBeenNthCalledWith(
      3,
      'PUT',
      '/path',
      { body: 2 },
      expect.any(Function),
    )
    expect(bare.api).toHaveBeenCalledWith(
      'DELETE',
      '/path',
      expect.any(Function),
    )
  })

  it('should resolve confirm with the user choice', async () => {
    const { confirm, homey } = createHomey({ result: true })

    await expect(homeyConfirm(homey, 'sure?')).resolves.toBe(true)

    expect(confirm).toHaveBeenCalledWith('sure?', null, expect.any(Function))
  })
})
