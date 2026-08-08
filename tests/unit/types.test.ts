import { describe, expect, it } from 'vitest'

// The surface itself is guarded at compile time in
// `tests/types/typed-managers.ts` — types erase, so no assertion here
// could observe them. What a test CAN observe is that the subpath is
// types-only: apps import it with `import type`, and it must cost them
// nothing at runtime.
describe('the types subpath', () => {
  it('ships no runtime code', async () => {
    const subpath: object = await import('../../src/types/homey.ts')

    expect(Object.keys(subpath)).toHaveLength(0)
  })
})
