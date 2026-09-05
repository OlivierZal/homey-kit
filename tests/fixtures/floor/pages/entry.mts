// Fixture entry point for the floor-closure kernel: one type-only
// import (erases at emit), one multi-line value import, one value
// import crossing directories, one bare specifier (not repo-relative).
import type { Thing } from '../types.mts'

import { helperA, helperB } from './lib/helper.mts'
import { CONST } from '../shared/consts.mts'
import { describe } from 'vitest'

export const entry: Thing = { value: helperA(helperB(CONST)) }

describe('fixture', () => {
  // Never run: the kernel only parses this text.
})
