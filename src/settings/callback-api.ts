/**
 * Promise-native transport over the settings SDK, whose `homey.api` and
 * `homey.confirm` are error-first callbacks — unlike the widget SDK's
 * promise-returning `homey.api`, which is why the two layers stay
 * separate.
 * @packageDocumentation
 */
import type Homey from 'homey/lib/HomeySettings.js'

/**
 * The one promisification primitive the per-verb wrappers share.
 * @param call - Invoker handed the error-first callback to pass to the SDK.
 * @returns The callback's success value.
 * @category Settings
 */
export const homeyCallback = async <T>(
  call: (callback: (error: Error | null, result: T) => void) => void,
): Promise<T> =>
  new Promise((resolve, reject) => {
    call((error, result) => {
      if (error !== null) {
        reject(error)
        return
      }
      resolve(result)
    })
  })

/**
 * `DELETE` against the app's own API surface.
 * @param homey - The settings SDK handle.
 * @param path - The declared route, method-matched by the app's manifest.
 * @returns Resolves once the handler completed.
 * @category Settings
 */
export const homeyApiDelete = async (
  homey: Homey,
  path: string,
): Promise<void> =>
  homeyCallback((callback) => {
    homey.api('DELETE', path, callback)
  })

/**
 * `GET` against the app's own API surface.
 * @param homey - The settings SDK handle.
 * @param path - The declared route, method-matched by the app's manifest.
 * @returns The handler's result.
 * @category Settings
 */
export const homeyApiGet = async <T>(homey: Homey, path: string): Promise<T> =>
  homeyCallback((callback) => {
    homey.api('GET', path, callback)
  })

/**
 * `POST` against the app's own API surface.
 * @param homey - The settings SDK handle.
 * @param path - The declared route, method-matched by the app's manifest.
 * @param body - The request payload, serialized by the SDK.
 * @returns The handler's result.
 * @category Settings
 */
export const homeyApiPost = async <T>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  homeyCallback((callback) => {
    homey.api('POST', path, body, callback)
  })

/**
 * `PUT` against the app's own API surface.
 * @param homey - The settings SDK handle.
 * @param path - The declared route, method-matched by the app's manifest.
 * @param body - The request payload, serialized by the SDK.
 * @returns The handler's result.
 * @category Settings
 */
export const homeyApiPut = async <T>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  homeyCallback((callback) => {
    homey.api('PUT', path, body, callback)
  })

/**
 * The SDK's native confirmation dialog, promisified.
 * @param homey - The settings SDK handle.
 * @param message - The question shown to the user.
 * @returns Whether the user confirmed.
 * @category Settings
 */
export const homeyConfirm = async (
  homey: Homey,
  message: string,
): Promise<boolean> =>
  homeyCallback((callback) => {
    homey.confirm(message, null, callback)
  })
