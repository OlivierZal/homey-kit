// Reaches the shared consts a second time (dedupe) and is reached back
// by them (cycle): the closure walk must terminate on both.
import { CONST } from '../../shared/consts.mts'

export const helperA = (value: number): number => value + CONST

export const helperB = (value: number): number => value * CONST
