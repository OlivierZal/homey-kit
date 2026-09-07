/**
 * Structural breadcrumb seam: anything with a `log` method fits — an
 * app instance passes itself, as it does for {@link Logger}.
 * @category Utilities
 */
export interface BreadcrumbLogger {
  /**
   * Receives the breadcrumb, one structured argument.
   */
  readonly log: (...args: readonly unknown[]) => void
}

/**
 * Leaves a settings-page route's breadcrumb in the app log. The
 * settings webview is otherwise invisible in a diagnostic report — its
 * routes are local reads, no cloud round-trip to log — which makes a
 * "settings fail to load" report undecidable: no line means the page's
 * JS never ran; lines without a completed sequence say where it
 * stopped. The label is `METHOD /path`, one spelling for every app.
 * @param logger - The app instance, or anything with a `log` method.
 * @param route - The route label, `METHOD /path` (`GET /settings/devices`).
 * @category Utilities
 */
export const logSettingsRoute = (
  logger: BreadcrumbLogger,
  route: string,
): void => {
  logger.log({ dataType: 'Settings page', route })
}
