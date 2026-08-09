// Serialization is fenced: this helper runs inside error paths, where
// throwing (a circular value) or returning a non-string (`undefined`,
// symbols, functions) would turn one failure into two.
const serializeSafely = (value: unknown): string | null => {
  let serialized: unknown
  try {
    serialized = JSON.stringify(value)
  } catch {
    return null
  }
  return typeof serialized === 'string' ? serialized : null
}

/**
 * Normalizes an unknown thrown value into a display string: an
 * `Error`'s message, a string verbatim, anything else JSON-serialized —
 * with a fixed fallback for values JSON cannot represent, because an
 * error path must never raise a second error.
 * @param error - The caught value.
 * @returns The user-displayable message.
 * @category Utilities
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return serializeSafely(error) ?? '[unserializable value]'
}
