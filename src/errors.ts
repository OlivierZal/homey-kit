/**
 * Thrown when a device or zone lookup fails: callers distinguish this
 * expected miss (surfaced as a user-visible warning) from a programming
 * error (logged only), while Homey's API layer still serializes the
 * localized message for settings and widget clients.
 * @category Errors
 */
export class NotFoundError extends Error {
  public override name = 'NotFoundError'
}
