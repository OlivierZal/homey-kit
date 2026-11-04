/**
 * Reads the app manifest into the settings description its pages render.
 *
 * Homey states a driver's settings and its pairing login form in the
 * manifest, localized, nested and split across drivers; a settings page
 * wants one flat list of controls it can group. These helpers do that
 * translation, and fold several devices' stored values into the single
 * value a grouped control shows.
 *
 * The manifest types here describe only what is read, in the shapes
 * Homey's manifest schema gives them, so the SDK's own `DriverManifest`
 * passes straight through (`tests/types/manifest-inputs.ts` pins it) and
 * so does any richer app type: naming no SDK type is what keeps this
 * package free of dependencies and peers.
 * @packageDocumentation
 */

/**
 * A control the settings page renders, flattened out of the manifest.
 * @category Manifest
 */
export interface DriverSetting {
  /**
   * The driver this control belongs to.
   */
  readonly driverId: string
  /**
   * The driver's display name, in the requested language.
   */
  readonly driverLabel: string
  /**
   * The setting id, which the app reads and writes.
   */
  readonly id: string
  /**
   * The control's label, in the requested language.
   */
  readonly title: string
  /**
   * The control kind, as the manifest declares it.
   */
  readonly type: string
  /**
   * The group this control belongs to, when the manifest nests it.
   */
  readonly groupId?: string | undefined
  /**
   * The group's label, in the requested language.
   */
  readonly groupLabel?: string | undefined
  /**
   * The highest value a numeric control accepts.
   */
  readonly max?: number | undefined
  /**
   * The lowest value a numeric control accepts.
   */
  readonly min?: number | undefined
  /**
   * The hint shown while a text control is empty.
   */
  readonly placeholder?: string
  /**
   * The unit shown beside a numeric control, in the requested language.
   */
  readonly units?: string | undefined
  /**
   * The choices a select control offers.
   */
  readonly values?: readonly DriverSettingValue[] | undefined
}

/**
 * One choice of a select control.
 * @category Manifest
 */
export interface DriverSettingValue {
  /**
   * The value stored when this choice is picked.
   */
  readonly id: string
  /**
   * The choice's label, in the requested language.
   */
  readonly label: string
}

/**
 * Strings by language tag, as a validated manifest carries them: English
 * is required, since it is the fallback every lookup lands on when a
 * language is missing.
 * @category Manifest
 */
export interface LocalizedStrings extends Readonly<Record<string, string>> {
  /**
   * The English string, always present.
   */
  readonly en: string
}

/**
 * The pairing step that carries the login form's labels.
 * @category Manifest
 */
export interface LoginSetting extends PairSetting {
  /**
   * The step that holds the login form.
   */
  readonly id: 'login'
  /**
   * The step's options: the form's labels and placeholders keyed by
   * field (`usernameLabel`, `passwordPlaceholder`), beside options that
   * are not text (`logo`), all typed by the SDK as unknown values.
   */
  readonly options: Readonly<Record<string, unknown>>
}

/**
 * The manifest fields these helpers read from a driver.
 * @category Manifest
 */
export interface ManifestDriver {
  /**
   * The driver id.
   */
  readonly id: string
  /**
   * The driver's display name, plain or keyed by language (com.heatzy
   * ships the plain form): a keyed value is served in the caller's
   * language, a plain string as is.
   */
  readonly name: ManifestString
  /**
   * The pairing steps, one of which may be the login form.
   */
  readonly pair?: readonly (LoginSetting | PairSetting)[]
  /**
   * The settings the driver declares: controls, and groups of them.
   */
  readonly settings?: readonly ManifestDriverSetting[]
}

/**
 * A setting as the manifest declares it: a control, or a group of
 * settings.
 * @category Manifest
 */
export type ManifestDriverSetting =
  ManifestDriverSettingData | ManifestDriverSettingGroup

/**
 * One control as the manifest declares it.
 * @category Manifest
 */
export interface ManifestDriverSettingData {
  /**
   * The setting id; the manifest admits a number.
   */
  readonly id: number | string
  /**
   * The control's label, plain or keyed by language.
   */
  readonly label: ManifestString
  /**
   * The control kind.
   */
  readonly type: string
  /**
   * The highest value a numeric control accepts.
   */
  readonly max?: number
  /**
   * The lowest value a numeric control accepts.
   */
  readonly min?: number
  /**
   * The unit shown beside a numeric control, plain or keyed by language.
   */
  readonly units?: ManifestString
  /**
   * The choices a select control offers.
   */
  readonly values?: readonly {
    readonly id: string
    readonly label: ManifestString
  }[]
}

/**
 * A group of settings as the manifest nests them: a group is what holds
 * `children`, and it may nest groups.
 * @category Manifest
 */
export interface ManifestDriverSettingGroup {
  /**
   * The settings the group holds: controls, and nested groups.
   */
  readonly children: readonly ManifestDriverSetting[]
  /**
   * The group's label, plain or keyed by language.
   */
  readonly label: ManifestString
  /**
   * The group id, which the manifest schema does not require.
   */
  readonly id?: string
}

/**
 * A string as the manifest states it: plain, or keyed by language tag.
 * Homey's manifest schema requires `en` in the keyed form, but the SDK's
 * generated type does not carry that requirement, so this input shape
 * does not either; `localize` enforces it.
 * @category Manifest
 */
export type ManifestString = string | Readonly<Record<string, string>>

/**
 * A pairing step, identified only.
 * @category Manifest
 */
export interface PairSetting {
  /**
   * The step id.
   */
  readonly id: string
}

// The login form is declared as label/placeholder pairs keyed by field
// (`usernameLabel`, `passwordPlaceholder`); the two controls are built by
// folding those keys onto the field each names.
const LOGIN_GROUP_ID = 'login'

const LABEL_SUFFIX = 'Label'

const PASSWORD_PREFIX = 'password'

const PLACEHOLDER_SUFFIX = 'Placeholder'

const isLoginSetting = (setting: PairSetting): setting is LoginSetting =>
  setting.id === LOGIN_GROUP_ID && 'options' in setting

/**
 * Picks a localized string, falling back to English.
 *
 * A plain string passes through: the manifest allows either form.
 * @param strings - The string, plain or keyed by language tag.
 * @param language - The language tag to prefer.
 * @returns The string in that language, or its English form.
 * @throws If a keyed string has no English value: Homey's manifest schema
 * requires `en` (`i18nObject`), so a validated manifest always carries it
 * and a miss is a contract break — loud, never a blank label.
 * @category Manifest
 */
export const localize = (strings: ManifestString, language: string): string => {
  if (typeof strings === 'string') {
    return strings
  }
  const localized = strings[language] ?? strings.en
  if (localized === undefined) {
    throw new Error('Localized manifest string without an English value')
  }
  return localized
}

// A keyed string is a plain record of strings: an array of strings is a
// list, not a translation, and would reach `localize` without an `en`.
const isManifestString = (value: unknown): value is ManifestString =>
  typeof value === 'string' ||
  (typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string'))

// The form's text is the label and placeholder entries: the step also
// carries options that are not text (`logo`, a file path), and the SDK
// types every value as unknown, so both the key and the value select.
const isFormText = (
  entry: [string, unknown],
): entry is [string, ManifestString] =>
  (entry[0].endsWith(LABEL_SUFFIX) || entry[0].endsWith(PLACEHOLDER_SUFFIX)) &&
  isManifestString(entry[1])

interface SettingContext {
  readonly driverId: string
  readonly driverLabel: string
  readonly language: string
  readonly group?: { readonly label: string; readonly id?: string | undefined }
}

const toDriverSetting = (
  { id, label, max, min, type, units, values }: ManifestDriverSettingData,
  { driverId, driverLabel, group, language }: SettingContext,
): DriverSetting => ({
  driverId,
  driverLabel,
  groupId: group?.id,
  groupLabel: group?.label,
  id: String(id),
  max,
  min,
  title: localize(label, language),
  type,
  units: units === undefined ? undefined : localize(units, language),
  values: values?.map(({ id: valueId, label: valueLabel }) => ({
    id: valueId,
    label: localize(valueLabel, language),
  })),
})

// A control carries the innermost group it sits in, which is the one the
// page regroups it under.
const flattenSettings = (
  settings: readonly ManifestDriverSetting[],
  context: SettingContext,
): DriverSetting[] =>
  settings.flatMap((setting) =>
    'children' in setting
      ? flattenSettings(setting.children, {
          ...context,
          group: {
            id: setting.id,
            label: localize(setting.label, context.language),
          },
        })
      : [toDriverSetting(setting, context)],
  )

/**
 * Builds the login form's controls out of a driver's pairing step.
 *
 * The manifest states the form as label and placeholder keys; each is
 * folded onto the field it names, so one username control and one
 * password control come out however many keys were declared. An option
 * that is neither (`logo`), or whose value is not a string, plain or
 * keyed by language, is not the form's text and is skipped. A driver
 * that pairs without a login form yields nothing.
 * @param driver - The driver whose pairing steps are read.
 * @param language - The language tag to prefer.
 * @returns The login controls, at most one per field.
 * @category Manifest
 */
export const getDriverLoginSetting = (
  driver: ManifestDriver,
  language: string,
): DriverSetting[] => {
  const { id: driverId, name, pair } = driver
  const driverLabel = localize(name, language)
  const driverLoginSetting: Record<string, DriverSetting> = {}
  const formText = Object.entries(
    pair?.find(isLoginSetting)?.options ?? {},
  ).filter(isFormText)
  for (const [option, text] of formText) {
    const isPassword = option.startsWith(PASSWORD_PREFIX)
    const key = isPassword ? 'password' : 'username'
    driverLoginSetting[key] ??= {
      driverId,
      driverLabel,
      groupId: LOGIN_GROUP_ID,
      id: key,
      title: '',
      type: isPassword ? 'password' : 'text',
    }
    driverLoginSetting[key] = {
      ...driverLoginSetting[key],
      [option.endsWith(PLACEHOLDER_SUFFIX) ? 'placeholder' : 'title']: localize(
        text,
        language,
      ),
    }
  }
  return Object.values(driverLoginSetting)
}

/**
 * Flattens a driver's declared settings into renderable controls.
 *
 * The manifest nests controls inside groups, which may nest groups; the
 * page wants them flat, each carrying the innermost group it came from
 * so it can be regrouped for display. A control declared outside any
 * group carries none, and a group without children contributes nothing.
 * @param driver - The driver whose settings are read.
 * @param language - The language tag to prefer.
 * @returns One entry per declared control, groups flattened.
 * @category Manifest
 */
export const getDriverSettings = (
  driver: ManifestDriver,
  language: string,
): DriverSetting[] => {
  const { id: driverId, name, settings } = driver
  return flattenSettings(settings ?? [], {
    driverId,
    driverLabel: localize(name, language),
    language,
  })
}

/**
 * Folds one device's stored settings into a driver-wide view.
 *
 * A grouped control shows one value for every device of its driver, so a
 * setting the devices disagree on has no value to show: it collapses to
 * `null` while the settings they do agree on keep folding independently.
 * @param driverSettings - The accumulated view, mutated in place.
 * @param settings - One device's stored settings.
 * @category Manifest
 */
export const mergeDeviceSettings = (
  driverSettings: Record<string, unknown>,
  settings: Record<string, unknown>,
): void => {
  for (const [settingId, value] of Object.entries(settings)) {
    if (!Object.hasOwn(driverSettings, settingId)) {
      driverSettings[settingId] = value
    } else if (driverSettings[settingId] !== value) {
      driverSettings[settingId] = null
    }
  }
}
