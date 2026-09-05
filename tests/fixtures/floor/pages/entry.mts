// Fixture entry point for the floor-closure kernel: one type-only
// import (erases at emit), one INLINE type specifier (retained at emit
// under `verbatimModuleSyntax`, so it is a value edge), one MIXED
// multi-line import (a type specifier beside a value one, the shape the
// apps' entries carry), one multi-line value import, one value import
// crossing directories, one bare specifier (not repo-relative). The
// multi-line statements are the point: a walk that reads one line at a
// time loses their edges while the single-line ones keep it green.
import type { Thing } from '../types.mts'

import { type Inline } from '../inline-types.mts'
import {
  type Mixed,
  MIXED,
} from '../mixed.mts'
import {
  helperA,
  helperB,
} from './lib/helper.mts'
import { CONST } from '../shared/consts.mts'
import { sep } from 'node:path'

export const entry: Thing = { value: helperA(helperB(CONST)) }

export const inline: Inline = { flag: sep === '/' }

export const mixed: Mixed = MIXED
