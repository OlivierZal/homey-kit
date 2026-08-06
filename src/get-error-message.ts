/**
 * Normalizes an unknown thrown value into a display string: an
 * `Error`'s message, a string verbatim, anything else JSON-serialized.
 * @param error - The caught value.
 * @returns The user-displayable message.
 * @category Utilities
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : JSON.stringify(error)
}
