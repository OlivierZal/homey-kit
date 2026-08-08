import { describe, expect, it } from 'vitest'

import {
  type ManifestDriver,
  getDriverLoginSetting,
  getDriverSettings,
  localize,
  mergeDeviceSettings,
} from '../../src/manifest/index.ts'

const driver: ManifestDriver = {
  id: 'thermostat',
  name: { en: 'Thermostat', fr: 'Thermostat FR' },
  pair: [
    { id: 'list_devices' },
    {
      id: 'login',
      options: {
        passwordLabel: { en: 'Password', fr: 'Mot de passe' },
        usernameLabel: { en: 'Email', fr: 'Courriel' },
        usernamePlaceholder: 'user@example.com',
      },
    },
  ],
  settings: [
    {
      children: [
        {
          id: 'always_on',
          label: { en: 'Always on', fr: 'Toujours allumé' },
          type: 'checkbox',
        },
        {
          id: 'offset',
          label: { en: 'Offset', fr: 'Décalage' },
          max: 5,
          min: -5,
          type: 'number',
          units: '°C',
          values: [{ id: 'auto', label: { en: 'Auto', fr: 'Automatique' } }],
        },
      ],
      id: 'general',
      label: { en: 'General', fr: 'Général' },
    },
  ],
}

describe(localize, () => {
  it('should pick the requested language', () => {
    expect(localize({ en: 'Name', fr: 'Nom' }, 'fr')).toBe('Nom')
  })

  it('should fall back to English when the language is missing', () => {
    expect(localize({ en: 'Name', fr: 'Nom' }, 'da')).toBe('Name')
  })

  it('should pass a plain string through', () => {
    expect(localize('user@example.com', 'fr')).toBe('user@example.com')
  })
})

describe(getDriverSettings, () => {
  it('should flatten the groups into localized controls', () => {
    expect(getDriverSettings(driver, 'fr')).toStrictEqual([
      {
        driverId: 'thermostat',
        driverLabel: 'Thermostat FR',
        groupId: 'general',
        groupLabel: 'Général',
        id: 'always_on',
        max: undefined,
        min: undefined,
        title: 'Toujours allumé',
        type: 'checkbox',
        units: undefined,
        values: undefined,
      },
      {
        driverId: 'thermostat',
        driverLabel: 'Thermostat FR',
        groupId: 'general',
        groupLabel: 'Général',
        id: 'offset',
        max: 5,
        min: -5,
        title: 'Décalage',
        type: 'number',
        units: '°C',
        values: [{ id: 'auto', label: 'Automatique' }],
      },
    ])
  })

  it('should fall back to English for a missing locale', () => {
    expect(getDriverSettings(driver, 'da')[0]).toMatchObject({
      driverLabel: 'Thermostat',
      groupLabel: 'General',
      title: 'Always on',
    })
  })

  it('should yield nothing for a driver without settings', () => {
    expect(
      getDriverSettings({ id: 'plug', name: { en: 'Plug' } }, 'en'),
    ).toStrictEqual([])
  })

  it('should yield nothing for a group without children', () => {
    expect(
      getDriverSettings(
        {
          id: 'plug',
          name: { en: 'Plug' },
          settings: [{ id: 'general', label: { en: 'General' } }],
        },
        'en',
      ),
    ).toStrictEqual([])
  })

  it('should keep an ungrouped declaration without a group id', () => {
    expect(
      getDriverSettings(
        {
          id: 'plug',
          name: { en: 'Plug' },
          settings: [
            {
              children: [
                { id: 'lock', label: { en: 'Lock' }, type: 'checkbox' },
              ],
              label: { en: 'General' },
            },
          ],
        },
        'en',
      )[0],
    ).toMatchObject({ groupId: undefined, groupLabel: 'General' })
  })
})

describe(getDriverLoginSetting, () => {
  it('should fold the label and placeholder keys onto their fields', () => {
    expect(getDriverLoginSetting(driver, 'fr')).toStrictEqual([
      {
        driverId: 'thermostat',
        driverLabel: 'Thermostat FR',
        groupId: 'login',
        id: 'password',
        title: 'Mot de passe',
        type: 'password',
      },
      {
        driverId: 'thermostat',
        driverLabel: 'Thermostat FR',
        groupId: 'login',
        id: 'username',
        placeholder: 'user@example.com',
        title: 'Courriel',
        type: 'text',
      },
    ])
  })

  it('should fall back to English for a missing locale', () => {
    expect(getDriverLoginSetting(driver, 'da')).toMatchObject([
      { title: 'Password' },
      { title: 'Email' },
    ])
  })

  it('should yield nothing for a driver that pairs without a login step', () => {
    expect(
      getDriverLoginSetting(
        { id: 'plug', name: { en: 'Plug' }, pair: [{ id: 'list_devices' }] },
        'en',
      ),
    ).toStrictEqual([])
  })

  it('should yield nothing for a driver without pairing steps', () => {
    expect(
      getDriverLoginSetting({ id: 'plug', name: { en: 'Plug' } }, 'en'),
    ).toStrictEqual([])
  })

  it('should ignore a login step declared without options', () => {
    expect(
      getDriverLoginSetting(
        { id: 'plug', name: { en: 'Plug' }, pair: [{ id: 'login' }] },
        'en',
      ),
    ).toStrictEqual([])
  })
})

describe(mergeDeviceSettings, () => {
  it('should take a value the accumulated view does not carry', () => {
    const driverSettings: Record<string, unknown> = {}
    mergeDeviceSettings(driverSettings, { offset: 2 })

    expect(driverSettings).toStrictEqual({ offset: 2 })
  })

  it('should keep a value the devices agree on', () => {
    const driverSettings: Record<string, unknown> = { offset: 2 }
    mergeDeviceSettings(driverSettings, { offset: 2 })

    expect(driverSettings).toStrictEqual({ offset: 2 })
  })

  it('should collapse a disagreed value while the others keep folding', () => {
    const driverSettings: Record<string, unknown> = {
      always_on: true,
      offset: 2,
    }
    mergeDeviceSettings(driverSettings, { always_on: true, offset: 3 })

    expect(driverSettings).toStrictEqual({ always_on: true, offset: null })
  })
})
