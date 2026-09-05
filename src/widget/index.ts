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
   * The SDK's promise-returning app-API call. Declared in method syntax
   * deliberately: the real `HomeyWidget` narrows `method` to four
   * literals, and a property-typed function member checks its
   * parameters contravariantly — the SDK instance was not assignable to
   * the wider `string`, which forced every consumer to keep a local
   * copy of this transport. Method signatures check bivariantly, which
   * is exactly the seam a structural SDK type needs.
   */
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- the rule exists to force contravariant parameter checking; here bivariance is the point: the widget SDK's `api` narrows `method` to four literals and must stay assignable to this wider structural type
  api(method: string, path: string, body?: object): Promise<unknown>
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
