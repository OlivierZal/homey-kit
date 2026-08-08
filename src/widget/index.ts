/**
 * Promise-native transport over the widget SDK, whose `homey.api`
 * already returns a promise — the exact counterpart of `./settings`,
 * which promisifies the settings SDK's error-first callbacks. Two SDKs,
 * two shapes, one transport layer each.
 *
 * The parameter type describes only the member these wrappers call, so
 * the package names no SDK types package and keeps its dependency and
 * peer lists empty. The real `HomeyWidget` satisfies it structurally.
 * @packageDocumentation
 */

/**
 * The widget SDK member this transport uses.
 * @category Widget
 */
export interface WidgetApi {
  /**
   * The SDK's promise-returning app-API call.
   */
  api: (method: string, path: string, body?: object) => Promise<unknown>
}

/**
 * Reads an app-API route.
 * @template T - The route's response shape.
 * @param homey - The widget SDK instance.
 * @param path - The app-API path.
 * @returns The route's response.
 * @category Widget
 */
export const homeyApiGet = async <T>(
  homey: WidgetApi,
  path: string,
): Promise<T> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the widget SDK types its api response as unknown
  (await homey.api('GET', path)) as T

/**
 * Posts to an app-API route.
 * @param homey - The widget SDK instance.
 * @param path - The app-API path.
 * @param body - The request body.
 * @category Widget
 */
export const homeyApiPost = async (
  homey: WidgetApi,
  path: string,
  body: object,
): Promise<void> => {
  await homey.api('POST', path, body)
}

/**
 * Puts to an app-API route.
 * @param homey - The widget SDK instance.
 * @param path - The app-API path.
 * @param body - The request body.
 * @category Widget
 */
export const homeyApiPut = async (
  homey: WidgetApi,
  path: string,
  body: object,
): Promise<void> => {
  await homey.api('PUT', path, body)
}
