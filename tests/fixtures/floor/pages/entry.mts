// Fixture entry point for the floor-closure kernel: one type-only
// import (erases at emit), one INLINE type specifier (retained at emit
// under `verbatimModuleSyntax`, so it is a value edge), one multi-line
// value import, one value import crossing directories, one bare
// specifier (not repo-relative).
import type { Thing } from '../types.mts'

import { type Inline } from '../inline-types.mts'
import {
  helperA,
  helperB,
} from './lib/helper.mts'
import { CONST } from '../shared/consts.mts'
import { sep } from 'node:path'

export const entry: Thing = { value: helperA(helperB(CONST)) }

export const inline: Inline = { flag: sep === '/' }
