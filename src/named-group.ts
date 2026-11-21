/**
 * Reads a named group of a match, throwing where the match has none of
 * that name. A match exposes its named groups as optional, even the
 * ones the pattern makes mandatory, so every read would otherwise carry
 * a fallback no match can reach. Reading through here keeps the
 * guarantee in one place — and a pattern that stops declaring the group
 * fails loudly instead of yielding an empty string a sweep would then
 * account for as something it had read. Shared by every kernel that
 * parses with named groups (route guards, webview stamping).
 * @param match - The match to read.
 * @param name - The group's name, as the pattern declares it.
 * @returns The text the group captured.
 * @throws An `Error` when the match carries no group of that name.
 */
export const namedGroup = (match: RegExpExecArray, name: string): string => {
  const value = match.groups?.[name]
  if (value === undefined) {
    throw new Error(
      `\`${name}\` is not a group of the pattern that matched \`${match[0]}\``,
    )
  }
  return value
}
