// Reached only through an INLINE type specifier (`import { type X }`):
// under `verbatimModuleSyntax` the statement survives emit as a
// side-effect import, so the kernel must count the file into the
// closure.
export interface Inline {
  readonly flag: boolean
}
