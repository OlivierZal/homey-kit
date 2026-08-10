// A match exposes its named groups as optional, even the ones the
// pattern makes mandatory, so every read would otherwise carry a
// fallback no match can reach. Reading through here keeps the guarantee
// in one place — and a pattern that stops declaring the group fails
// loudly instead of yielding an empty string the sweeps would then
// account for as a path they had read.
export const namedGroup = (match: RegExpExecArray, name: string): string => {
  const value = match.groups?.[name]
  if (value === undefined) {
    throw new Error(
      `route guard: \`${name}\` is not a group of the pattern that matched \`${match[0]}\``,
    )
  }
  return value
}
