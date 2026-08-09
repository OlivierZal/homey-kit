// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  booleanOptions,
  booleanStrings,
  configureNumericInput,
  createInput,
  createLabel,
  createOption,
  createSelect,
  getButton,
  getDetails,
  getDiv,
  getFieldset,
  getInput,
  getSelect,
  getSpan,
  parseFormValue,
} from '../../src/dom/index.ts'

const numberInput = (): HTMLInputElement => {
  const input = document.createElement('input')

  input.type = 'number'
  return input
}

describe('booleanStrings', () => {
  it('should carry the wire pair in order', () => {
    expect(booleanStrings).toStrictEqual(['false', 'true'])
  })
})

describe('typed accessors', () => {
  const cases = [
    { get: getButton, tag: 'button', type: 'button' },
    { get: getDetails, tag: 'details', type: 'details' },
    { get: getDiv, tag: 'div', type: 'div' },
    { get: getFieldset, tag: 'fieldset', type: 'fieldset' },
    { get: getInput, tag: 'input', type: 'input' },
    { get: getSelect, tag: 'select', type: 'select' },
    { get: getSpan, tag: 'span', type: 'span' },
  ]

  beforeEach(() => {
    document.body.replaceChildren()
  })

  it.each(cases)('should read a $tag by id', ({ get, tag }) => {
    const element = document.createElement(tag)

    element.id = 'target'
    document.body.replaceChildren(element)

    expect(get('target').id).toBe('target')
  })

  it.each(cases)('should name the wrong kind for $type', ({ get, type }) => {
    const element = document.createElement('p')

    element.id = 'target'
    document.body.replaceChildren(element)

    expect(() => get('target')).toThrow(
      `Element with id \`target\` is not a ${type}`,
    )
  })

  it('should say not found rather than wrong type when the id is absent', () => {
    expect(() => getButton('absent')).toThrow(
      'Element with id `absent` not found',
    )
  })
})

describe(createOption, () => {
  it('should append the value and its label', () => {
    const select = document.createElement('select')

    createOption(select, { id: 'auto', label: 'Automatic' })

    expect(select.options).toHaveLength(1)
    expect(select.options[0]?.value).toBe('auto')
    expect(select.options[0]?.text).toBe('Automatic')
  })

  it('should skip a value the select already carries', () => {
    const select = document.createElement('select')

    createOption(select, { id: 'auto', label: 'Automatic' })
    createOption(select, { id: 'auto', label: 'Automatique' })

    expect(select.options).toHaveLength(1)
    expect(select.options[0]?.text).toBe('Automatic')
  })

  it('should hold a value the selector grammar would have choked on', () => {
    const select = document.createElement('select')

    createOption(select, { id: 'a"b', label: 'quoted' })
    createOption(select, { id: 'a"b', label: 'quoted again' })

    expect(select.options).toHaveLength(1)
    expect(select.options[0]?.value).toBe('a"b')
  })
})

describe(booleanOptions, () => {
  it('should translate each wire value through the caller lookup', () => {
    const translate = vi.fn<(key: string) => string>(
      (key) => `translated:${key}`,
    )

    expect(booleanOptions(translate)).toStrictEqual([
      { id: 'false', label: 'translated:settings.boolean.false' },
      { id: 'true', label: 'translated:settings.boolean.true' },
    ])

    expect(translate).toHaveBeenCalledTimes(2)
  })
})

describe(configureNumericInput, () => {
  it('should leave a non-numeric input untouched', () => {
    const input = document.createElement('input')

    input.type = 'text'
    configureNumericInput(input, { max: 10, min: 1 })

    expect(input.getAttribute('inputmode')).toBeNull()
    expect(input.min).toBe('')
    expect(input.max).toBe('')
  })

  it('should hint the mobile keyboard and set both bounds', () => {
    const input = numberInput()

    configureNumericInput(input, { max: 31, min: 10 })

    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(input.min).toBe('10')
    expect(input.max).toBe('31')
  })

  it('should set only the bound the domain declares', () => {
    const lower = numberInput()
    const upper = numberInput()

    configureNumericInput(lower, { min: 10 })
    configureNumericInput(upper, { max: 31 })

    expect(lower.min).toBe('10')
    expect(lower.max).toBe('')
    expect(upper.min).toBe('')
    expect(upper.max).toBe('31')
  })
})

describe(createLabel, () => {
  it('should name the control and adopt it', () => {
    const input = createInput({ id: 'username', type: 'text' })
    const label = createLabel(input, 'Username', 'homey-form-label')

    expect(label.htmlFor).toBe('username')
    expect(label.textContent).toBe('Username')
    expect(label.classList.contains('homey-form-label')).toBe(true)
    expect(label.contains(input)).toBe(true)
  })

  it('should stay class-free for a bare-element page', () => {
    const input = createInput({ id: 'temperature', type: 'text' })

    expect(createLabel(input, 'Temperature').className).toBe('')
  })
})

describe(createInput, () => {
  it('should build a decorated input with its placeholder and value', () => {
    const input = createInput({
      className: 'homey-form-input',
      id: 'username',
      placeholder: 'you@example.com',
      type: 'email',
      value: 'olivier@example.com',
    })

    expect(input.classList.contains('homey-form-input')).toBe(true)
    expect(input.id).toBe('username')
    expect(input.type).toBe('email')
    expect(input.value).toBe('olivier@example.com')
    expect(input.placeholder).toBe('you@example.com')
  })

  it('should empty a null value and skip an absent placeholder', () => {
    const input = createInput({ id: 'password', type: 'password', value: null })

    expect(input.value).toBe('')
    expect(input.className).toBe('')
    expect(input.getAttribute('placeholder')).toBeNull()
  })

  it('should carry the numeric bounds through to the control', () => {
    const input = createInput({
      id: 'target',
      max: 31,
      min: 10,
      type: 'number',
    })

    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(input.min).toBe('10')
    expect(input.max).toBe('31')
  })
})

describe(createSelect, () => {
  it('should prefix the empty option before the declared values', () => {
    const select = createSelect(
      'mode',
      [
        { id: 'auto', label: 'Automatic' },
        { id: 'cool', label: 'Cooling' },
      ],
      'homey-form-select',
    )

    expect(select.id).toBe('mode')
    expect(select.classList.contains('homey-form-select')).toBe(true)
    expect([...select.options].map(({ value }) => value)).toStrictEqual([
      '',
      'auto',
      'cool',
    ])
  })

  it('should stay class-free for a bare-element page', () => {
    const select = createSelect('mode', [])

    expect(select.className).toBe('')
    expect(select.options).toHaveLength(1)
  })
})

describe(parseFormValue, () => {
  it('should read an empty value as null', () => {
    const select = createSelect('mode', [])

    expect(parseFormValue(select)).toBeNull()
  })

  it('should read a checkbox as its checked state', () => {
    const checkbox = createInput({ id: 'onoff', type: 'checkbox' })

    expect(parseFormValue(checkbox)).toBe(false)

    checkbox.checked = true

    expect(parseFormValue(checkbox)).toBe(true)
  })

  it('should read an indeterminate checkbox as null', () => {
    const checkbox = createInput({ id: 'onoff', type: 'checkbox' })
    checkbox.indeterminate = true

    expect(parseFormValue(checkbox)).toBeNull()
  })

  it('should hand a bounded number input to the number strategy', () => {
    const input = createInput({
      id: 'target',
      max: 30,
      min: 10,
      type: 'number',
      value: '35',
    })
    const clamp = vi.fn<(input: HTMLInputElement) => number>(({ max }) =>
      Number(max),
    )

    expect(parseFormValue(input, clamp)).toBe(30)
    expect(clamp).toHaveBeenCalledWith(input)
  })

  it('should fall back to the plain read without a number strategy', () => {
    const input = createInput({
      id: 'target',
      max: 30,
      min: 10,
      type: 'number',
      value: '35',
    })

    expect(parseFormValue(input)).toBe(35)
  })

  it('should not treat a half-bounded number input as bounded', () => {
    const parseNumber = vi.fn<() => number>(() => 0)
    const noMax = createInput({ id: 'floor', min: 10, type: 'number' })
    noMax.value = '12'
    const noMin = createInput({ id: 'ceiling', max: 30, type: 'number' })
    noMin.value = '12'

    expect(parseFormValue(noMax, parseNumber)).toBe(12)
    expect(parseFormValue(noMin, parseNumber)).toBe(12)
    expect(parseNumber).not.toHaveBeenCalled()
  })

  it('should read the boolean strings as booleans', () => {
    const select = createSelect(
      'enabled',
      booleanOptions((key) => key),
    )
    select.value = 'true'

    expect(parseFormValue(select)).toBe(true)

    select.value = 'false'

    expect(parseFormValue(select)).toBe(false)
  })

  it('should read a finite numeric string as a number', () => {
    const select = createSelect('speed', [{ id: '42', label: 'Fast' }])
    select.value = '42'

    expect(parseFormValue(select)).toBe(42)
  })

  it('should keep a non-numeric string as-is', () => {
    const select = createSelect('mode', [{ id: 'auto', label: 'Automatic' }])
    select.value = 'auto'

    expect(parseFormValue(select)).toBe('auto')
  })
})
