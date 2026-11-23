// What the Homey CLI composes an app's texts into, single-sourced: an
// app writes them in `.homeycompose/locales/<language>.json` and the
// CLI generates `locales/<language>.json` by merging each source INTO
// the generated file it finds. A merge adds and overwrites, and never
// removes: a text written in the generated file alone survives every
// build until the day the file is generated afresh, and a text the
// source dropped keeps shipping. `findLocaleDrift` compares the two
// trees text by text; each app declares its own `describe`/`it` over
// it, like the API kernels beside it. It reads whole-language sources:
// the CLI's namespaced files (`en.<section>.json`) and `$`-prefixed
// sections, which it moves into the manifest, are not composed here
// and read as drift.

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

type Texts = ReadonlyMap<string, unknown>

/**
 * One language whose generated file is not what its source composes
 * to, each text named by its dotted path (`settings.title`).
 * @category Testing
 */
export interface LocaleDrift {
  /**
   * The texts whose generated wording is not the source's.
   */
  readonly differing: readonly string[]
  /**
   * The texts the generated file holds and the source does not declare.
   */
  readonly generatedOnly: readonly string[]
  readonly language: string
  /**
   * The texts the source declares and the generated file lacks.
   */
  readonly sourceOnly: readonly string[]
}

const NO_TEXTS: Texts = new Map()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readTexts = (value: unknown, prefix = ''): [string, unknown][] =>
  isRecord(value)
    ? Object.entries(value).flatMap(([key, child]) =>
        readTexts(child, prefix === '' ? key : `${prefix}.${key}`),
      )
    : [[prefix, value]]

// The `.json` files of a directory, as the CLI reads them: the file
// name is the language.
const readLocales = async (directory: string): Promise<Map<string, Texts>> => {
  const files = await readdir(directory)
  return new Map(
    await Promise.all(
      files
        .filter((file) => path.extname(file) === '.json')
        .map(async (file): Promise<[string, Texts]> => {
          const locale: unknown = JSON.parse(
            await readFile(path.join(directory, file), 'utf8'),
          )
          return [path.basename(file, '.json'), new Map(readTexts(locale))]
        }),
    ),
  )
}

const compare = (
  language: string,
  source: Texts,
  generated: Texts,
): LocaleDrift => ({
  differing: source
    .entries()
    .filter(
      ([text, wording]) =>
        generated.has(text) && generated.get(text) !== wording,
    )
    .map(([text]) => text)
    .toArray(),
  generatedOnly: generated
    .keys()
    .filter((text) => !source.has(text))
    .toArray(),
  language,
  sourceOnly: source
    .keys()
    .filter((text) => !generated.has(text))
    .toArray(),
})

/**
 * Compares an app's generated locale files against the sources the
 * Homey CLI composes them from. A language one side lacks counts with
 * its every text.
 * @param appDirectory - The app's root, which holds
 * `.homeycompose/locales` and `locales`.
 * @returns One entry per language that drifted, sorted by language;
 * none when every generated file is exactly what its source declares.
 * @throws When the app declares no locale source: a comparison of
 * nothing would pass.
 * @category Testing
 */
export const findLocaleDrift = async (
  appDirectory: string,
): Promise<LocaleDrift[]> => {
  const sourceDirectory = path.join(appDirectory, '.homeycompose', 'locales')
  const [sources, generated] = await Promise.all([
    readLocales(sourceDirectory),
    readLocales(path.join(appDirectory, 'locales')),
  ])
  if (sources.size === 0) {
    throw new Error(
      `${sourceDirectory}: no locale source to compare; the directory names no \`<language>.json\``,
    )
  }
  return [...new Set([...sources.keys(), ...generated.keys()])]
    .toSorted((left, right) => left.localeCompare(right))
    .map((language) =>
      compare(
        language,
        sources.get(language) ?? NO_TEXTS,
        generated.get(language) ?? NO_TEXTS,
      ),
    )
    .filter(
      ({ differing, generatedOnly, sourceOnly }) =>
        differing.length + generatedOnly.length + sourceOnly.length > 0,
    )
}
