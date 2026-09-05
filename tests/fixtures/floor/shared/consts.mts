// Value-imports its own importer: the closure walk meets a cycle here.
import { helperA } from '../pages/lib/helper.mts'

export const CONST = helperA(1)
