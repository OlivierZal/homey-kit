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

  // Homey's schema requires `en` on a keyed string; the SDK's generated
  // type does not carry the requirement, so the miss has to stay loud here.
  it('should throw on a keyed string without an English value', () => {
    expect(() => localize({ fr: 'Nom' }, 'da')).toThrow(
      'Localized manifest string without an English value',
    )
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

  // The manifest admits a plain string where the kit once typed
  // localized strings only: the label is the string, in every language.
  it('should serve a plain-string driver name as the label in any language', () => {
    expect(
      getDriverSettings(
        {
          id: 'heatzy',
          name: 'Heatzy',
          settings: [
            {
              children: [
                { id: 'on_mode', label: { en: 'On mode' }, type: 'dropdown' },
              ],
              id: 'general',
              label: { en: 'General' },
            },
          ],
        },
        'fr',
      ),
    ).toMatchObject([{ driverId: 'heatzy', driverLabel: 'Heatzy' }])
  })

  it('should yield nothing for a group without children', () => {
    expect(
      getDriverSettings(
        {
          id: 'plug',
          name: { en: 'Plug' },
          settings: [{ children: [], id: 'general', label: { en: 'General' } }],
        },
        'en',
      ),
    ).toStrictEqual([])
  })

  it('should serve a group without an id by its label alone', () => {
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

  // Groups nest; the page regroups a control under the innermost one.
  it('should flatten a nested group onto its innermost group', () => {
    expect(
      getDriverSettings(
        {
          id: 'plug',
          name: { en: 'Plug' },
          settings: [
            {
              children: [
                {
                  id: 'outer_only',
                  label: { en: 'Outer only' },
                  type: 'checkbox',
                },
                {
                  children: [
                    { id: 'nested', label: { en: 'Nested' }, type: 'checkbox' },
                  ],
                  id: 'inner',
                  label: { en: 'Inner', fr: 'Interne' },
                },
              ],
              id: 'outer',
              label: { en: 'Outer' },
            },
          ],
        },
        'fr',
      ),
    ).toMatchObject([
      { groupId: 'outer', groupLabel: 'Outer', id: 'outer_only' },
      { groupId: 'inner', groupLabel: 'Interne', id: 'nested' },
    ])
  })

  // The schema lets a control sit outside any group; 8.x read only the
  // groups' children and dropped such a control without a trace.
  it('should serve a control declared outside any group, with no group', () => {
    expect(
      getDriverSettings(
        {
          id: 'plug',
          name: { en: 'Plug' },
          settings: [{ id: 'lock', label: { en: 'Lock' }, type: 'checkbox' }],
        },
        'en',
      ),
    ).toStrictEqual([
      {
        driverId: 'plug',
        driverLabel: 'Plug',
        groupId: undefined,
        groupLabel: undefined,
        id: 'lock',
        max: undefined,
        min: undefined,
        title: 'Lock',
        type: 'checkbox',
        units: undefined,
        values: undefined,
      },
    ])
  })

  it('should serve a numeric setting id as a string', () => {
    expect(
      getDriverSettings(
        {
          id: 'plug',
          name: { en: 'Plug' },
          settings: [
            {
              children: [{ id: 7, label: { en: 'Seventh' }, type: 'checkbox' }],
              id: 'general',
              label: { en: 'General' },
            },
          ],
        },
        'en',
      ),
    ).toMatchObject([{ groupId: 'general', id: '7' }])
  })

  it('should localize a unit keyed by language', () => {
    expect(
      getDriverSettings(
        {
          id: 'plug',
          name: { en: 'Plug' },
          settings: [
            {
              id: 'delay',
              label: { en: 'Delay' },
              type: 'number',
              units: { en: 'minutes', fr: 'minutes FR' },
            },
          ],
        },
        'fr',
      ),
    ).toMatchObject([{ units: 'minutes FR' }])
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

  // Both apps' login steps list `logo` beside the labels: a string, but
  // not the form's text — read by value alone it would become a username
  // control titled after a file.
  it('should ignore an option that is neither a label nor a placeholder', () => {
    expect(
      getDriverLoginSetting(
        {
          id: 'plug',
          name: { en: 'Plug' },
          pair: [
            {
              id: 'login',
              options: { logo: 'logo.png', passwordLabel: { en: 'Password' } },
            },
          ],
        },
        'en',
      ),
    ).toStrictEqual([
      {
        driverId: 'plug',
        driverLabel: 'Plug',
        groupId: 'login',
        id: 'password',
        title: 'Password',
        type: 'password',
      },
    ])
  })

  // The SDK types a step's options as unknown values: one that is not a
  // string, plain or keyed by language, is no text the form can show.
  it('should skip a label or placeholder whose value is not a string, plain or keyed', () => {
    expect(
      getDriverLoginSetting(
        {
          id: 'plug',
          name: { en: 'Plug' },
          pair: [
            {
              id: 'login',
              options: {
                passwordLabel: { en: 'Password', hidden: false },
                passwordPlaceholder: null,
                usernameLabel: 42,
                usernamePlaceholder: { en: 'user@example.com' },
              },
            },
          ],
        },
        'en',
      ),
    ).toStrictEqual([
      {
        driverId: 'plug',
        driverLabel: 'Plug',
        groupId: 'login',
        id: 'username',
        placeholder: 'user@example.com',
        title: '',
        type: 'text',
      },
    ])
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
