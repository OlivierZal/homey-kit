/**
 * Reads the app manifest into the settings description its pages render.
 *
 * Homey states a driver's settings and its pairing login form in the
 * manifest, localized, nested and split across drivers; a settings page
 * wants one flat list of controls it can group. These helpers do that
 * translation, and fold several devices' stored values into the single
 * value a grouped control shows.
 *
 * The manifest types here describe only what is read, so an app's own
 * richer manifest type stays assignable: naming no SDK type is what
 * keeps this package free of dependencies and peers.
 * @packageDocumentation
 */

/**
 * A control the settings page renders, flattened out of the manifest.
 * @category Manifest
 */
export interface DriverSetting {
  /**
  The driver this control belongs to.
   */
  readonly driverId: string
  /**
  The driver's display name, in the requested language.
   */
  readonly driverLabel: string
  /**
  The setting id, which the app reads and writes.
   */
  readonly id: string
  /**
  The control's label, in the requested language.
   */
  readonly title: string
  /**
  The control kind, as the manifest declares it.
   */
  readonly type: string
  /**
  The group this control belongs to, when the manifest nests it.
   */
  readonly groupId?: string | undefined
  /**
  The group's label, in the requested language.
   */
  readonly groupLabel?: string
  /**
  The highest value a numeric control accepts.
   */
  readonly max?: number | undefined
  /**
  The lowest value a numeric control accepts.
   */
  readonly min?: number | undefined
  /**
  The hint shown while a text control is empty.
   */
  readonly placeholder?: string
  /**
  The unit shown beside a numeric control.
   */
  readonly units?: string | undefined
  /**
  The choices a select control offers.
   */
  readonly values?: readonly DriverSettingValue[] | undefined
}

/**
 * One choice of a select control.
 * @category Manifest
 */
export interface DriverSettingValue {
  /**
  The value stored when this choice is picked.
   */
  readonly id: string
  /**
  The choice's label, in the requested language.
   */
  readonly label: string
}

/**
 * Strings by language tag. English is required: it is the fallback every
 * lookup lands on when a language is missing.
 * @category Manifest
 */
export interface LocalizedStrings extends Partial<Record<string, string>> {
  /**
  The English string, always present.
   */
  readonly en: string
}

/**
 * The pairing step that carries the login form's labels.
 * @category Manifest
 */
export interface LoginSetting extends PairSetting {
  /**
  The step that holds the login form.
   */
  readonly id: 'login'
  /**
  The form's labels and placeholders, keyed by field.
   */
  readonly options: Readonly<Record<string, string | LocalizedStrings>>
}

/**
 * The manifest fields these helpers read from a driver.
 * @category Manifest
 */
export interface ManifestDriver {
  /**
  The driver id.
   */
  readonly id: string
  /**
  The driver's localized display name.
   */
  readonly name: LocalizedStrings
  /**
  The pairing steps, one of which may be the login form.
   */
  readonly pair?: readonly (LoginSetting | PairSetting)[]
  /**
  The setting groups the driver declares.
   */
  readonly settings?: readonly ManifestDriverSetting[]
}

/**
 * A group of settings as the manifest nests them.
 * @category Manifest
 */
export interface ManifestDriverSetting {
  /**
  The group's localized label.
   */
  readonly label: LocalizedStrings
  /**
  The controls the group holds.
   */
  readonly children?: readonly ManifestDriverSettingData[]
  /**
  The group id, absent on an ungrouped declaration.
   */
  readonly id?: string
}

/**
 * One control as the manifest declares it.
 * @category Manifest
 */
export interface ManifestDriverSettingData {
  /**
  The setting id.
   */
  readonly id: string
  /**
  The control's localized label.
   */
  readonly label: LocalizedStrings
  /**
  The control kind.
   */
  readonly type: string
  /**
  The highest value a numeric control accepts.
   */
  readonly max?: number
  /**
  The lowest value a numeric control accepts.
   */
  readonly min?: number
  /**
  The unit shown beside a numeric control.
   */
  readonly units?: string
  /**
  The choices a select control offers.
   */
  readonly values?: readonly {
    readonly id: string
    readonly label: LocalizedStrings
  }[]
}

/**
 * A pairing step, identified only.
 * @category Manifest
 */
export interface PairSetting {
  /**
  The step id.
   */
  readonly id: string
}

// The login form is declared as label/placeholder pairs keyed by field
// (`usernameLabel`, `passwordPlaceholder`); the two controls are built by
// folding those keys onto the field each names.
const LOGIN_GROUP_ID = 'login'

const PASSWORD_PREFIX = 'password'

const PLACEHOLDER_SUFFIX = 'Placeholder'

const isLoginSetting = (setting: PairSetting): setting is LoginSetting =>
  setting.id === LOGIN_GROUP_ID && 'options' in setting

/**
 * Picks a localized string, falling back to English.
 *
 * A plain string passes through: the manifest allows either form.
 * @param strings - The localized strings, or an already-plain string.
 * @param language - The language tag to prefer.
 * @returns The string in that language, or its English form.
 * @category Manifest
 */
export const localize = (
  strings: string | LocalizedStrings,
  language: string,
): string =>
  typeof strings === 'string' ? strings : (strings[language] ?? strings.en)

/**
 * Builds the login form's controls out of a driver's pairing step.
 *
 * The manifest states the form as label and placeholder keys; each is
 * folded onto the field it names, so one username control and one
 * password control come out however many keys were declared. A driver
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
  const loginOptions = pair?.find(isLoginSetting)?.options ?? {}
  for (const [option, label] of Object.entries(loginOptions)) {
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
        label,
        language,
      ),
    }
  }
  return Object.values(driverLoginSetting)
}

/**
 * Flattens a driver's declared settings into renderable controls.
 *
 * The manifest nests controls inside groups; the page wants them flat,
 * each carrying the group it came from so it can be regrouped for
 * display. A group without children contributes nothing.
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
  const driverLabel = localize(name, language)
  return (settings ?? []).flatMap(
    ({ children, id: groupId, label: groupLabel }) =>
      (children ?? []).map(({ id, label, max, min, type, units, values }) => ({
        driverId,
        driverLabel,
        groupId,
        groupLabel: localize(groupLabel, language),
        id,
        max,
        min,
        title: localize(label, language),
        type,
        units,
        values: values?.map(({ id: valueId, label: valueLabel }) => ({
          id: valueId,
          label: localize(valueLabel, language),
        })),
      })),
  )
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
