// Reached through a MIXED import — a type specifier beside a value one,
// exploded over several lines as prettier writes it in the apps
// (com.melcloud.extension's `{ type …, DISABLED_SOURCE } from
// '../types.mts'`): the statement is a value edge, and the walk must
// read it across its lines.
export interface Mixed {
  readonly kind: string
}

export const MIXED: Mixed = { kind: 'mixed' }
