// Reached through a type-only import alone: the kernel must never read
// this file into the emitted closure.
export interface Thing {
  readonly value: number
}
