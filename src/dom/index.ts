/**
 * The webview pages' shared DOM layer: typed element accessors that name
 * what went wrong, and the builders that encode Homey's `homey-form-*`
 * control markup. The class names stay caller-supplied — the settings
 * pages decorate their controls, the widgets style bare elements through
 * element selectors — so one builder serves both without either page
 * inheriting the other's look.
 * @packageDocumentation
 */

/**
 * Everything a form input needs to exist.
 * @category DOM
 */
export interface CreateInputOptions extends NumericBounds {
  /**
   * The element id, which its label points at.
   */
  readonly id: string
  /**
   * The input type, driving both keyboard and validation.
   */
  readonly type: string
  /**
   * The page's input class, omitted by bare-element pages.
   */
  readonly className?: string
  /**
   * The hint shown while the field is empty.
   */
  readonly placeholder?: string | undefined
  /**
   * The starting value; `null` and `undefined` both mean empty.
   */
  readonly value?: string | null
}

/**
 * The form controls the builders accept.
 * @category DOM
 */
export type HTMLValueElement = HTMLInputElement | HTMLSelectElement

/**
 * The range a numeric control accepts, either end optional.
 * @category DOM
 */
export interface NumericBounds {
  /**
   * The highest accepted value, omitted when the domain sets none.
   */
  readonly max?: number | undefined
  /**
   * The lowest accepted value, omitted when the domain sets none.
   */
  readonly min?: number | undefined
}

/**
 * One entry of a select: the value that travels, and the text shown.
 * @category DOM
 */
export interface SelectOption {
  /**
   * The value the form submits for this entry.
   */
  readonly id: string
  /**
   * The text the user reads.
   */
  readonly label: string
}

/**
 * The two values a boolean setting travels as on the wire.
 * @category DOM
 */
export const booleanStrings: readonly string[] = [
  'false',
  'true',
] satisfies `${boolean}`[]

// The optional decoration every builder takes: a settings page passes
// its `homey-form-*` class, a widget passes nothing.
const applyClassName = (element: HTMLElement, className?: string): void => {
  if (className !== undefined) {
    element.classList.add(className)
  }
}

// Two diagnoses, never one: an id that is absent and an id that names
// the wrong kind of element are different mistakes, and a single
// "missing element" message sends the reader looking in the wrong file.
const getElement = <T extends HTMLElement>(
  id: string,
  elementConstructor: new () => T,
  elementType: string,
): T => {
  const element = document.querySelector(`#${id}`)
  if (element === null) {
    throw new TypeError(`Element with id \`${id}\` not found`)
  }
  if (!(element instanceof elementConstructor)) {
    throw new TypeError(`Element with id \`${id}\` is not a ${elementType}`)
  }
  return element
}

/**
 * Reads a button, narrowing the untyped lookup the DOM answers with.
 * @param id - The element id, without `#`.
 * @returns The element, typed as a button.
 * @throws TypeError When the id is absent, or names another kind of element.
 * @category DOM
 */
export const getButton = (id: string): HTMLButtonElement =>
  getElement(id, HTMLButtonElement, 'button')

/**
 * Reads a details element, narrowing the untyped lookup.
 * @param id - The element id, without `#`.
 * @returns The element, typed as a details.
 * @throws TypeError When the id is absent, or names another kind of element.
 * @category DOM
 */
export const getDetails = (id: string): HTMLDetailsElement =>
  getElement(id, HTMLDetailsElement, 'details')

/**
 * Reads a div, narrowing the untyped lookup.
 * @param id - The element id, without `#`.
 * @returns The element, typed as a div.
 * @throws TypeError When the id is absent, or names another kind of element.
 * @category DOM
 */
export const getDiv = (id: string): HTMLDivElement =>
  getElement(id, HTMLDivElement, 'div')

/**
 * Reads a fieldset, narrowing the untyped lookup.
 * @param id - The element id, without `#`.
 * @returns The element, typed as a fieldset.
 * @throws TypeError When the id is absent, or names another kind of element.
 * @category DOM
 */
export const getFieldset = (id: string): HTMLFieldSetElement =>
  getElement(id, HTMLFieldSetElement, 'fieldset')

/**
 * Reads an input, narrowing the untyped lookup.
 * @param id - The element id, without `#`.
 * @returns The element, typed as an input.
 * @throws TypeError When the id is absent, or names another kind of element.
 * @category DOM
 */
export const getInput = (id: string): HTMLInputElement =>
  getElement(id, HTMLInputElement, 'input')

/**
 * Reads a select, narrowing the untyped lookup.
 * @param id - The element id, without `#`.
 * @returns The element, typed as a select.
 * @throws TypeError When the id is absent, or names another kind of element.
 * @category DOM
 */
export const getSelect = (id: string): HTMLSelectElement =>
  getElement(id, HTMLSelectElement, 'select')

/**
 * Reads a span, narrowing the untyped lookup.
 * @param id - The element id, without `#`.
 * @returns The element, typed as a span.
 * @throws TypeError When the id is absent, or names another kind of element.
 * @category DOM
 */
export const getSpan = (id: string): HTMLSpanElement =>
  getElement(id, HTMLSpanElement, 'span')

/**
 * Appends an entry to a select, unless it already carries that value —
 * so a repopulated select does not grow duplicates.
 * @param select - The select to append to.
 * @param option - The entry to add.
 * @category DOM
 */
export const createOption = (
  select: HTMLSelectElement,
  option: SelectOption,
): void => {
  // Membership is read off the options, never through a built selector:
  // a value carrying a quote or a backslash has to be escaped for the
  // selector grammar, and getting that wrong turns a duplicate check
  // into a thrown parse error. `createElement` over the legacy `Option`
  // factory for the same reason — fewer browser APIs to be right about.
  if ([...select.options].some(({ value }) => value === option.id)) {
    return
  }
  const element = document.createElement('option')
  element.value = option.id
  element.text = option.label
  select.append(element)
}

/**
 * The translated boolean pair, for a select whose domain declares no
 * values of its own.
 * @param translate - The page's translation lookup, called once per value.
 * @returns Both wire values, each carrying its translated label.
 * @category DOM
 */
export const booleanOptions = (
  translate: (key: string) => string,
): SelectOption[] =>
  booleanStrings.map((value) => ({
    id: value,
    label: translate(`settings.boolean.${value}`),
  }))

/**
 * Turns a number input into a numeric one: the mobile keyboard hint plus
 * whichever bounds the domain declares. A no-op on any other type, so a
 * builder may call it without asking.
 * @param input - The control to configure.
 * @param bounds - The accepted range.
 * @category DOM
 */
export const configureNumericInput = (
  input: HTMLInputElement,
  bounds: NumericBounds,
): void => {
  if (input.type !== 'number') {
    return
  }
  const { max, min } = bounds
  input.setAttribute('inputmode', 'numeric')
  if (min !== undefined) {
    input.min = String(min)
  }
  if (max !== undefined) {
    input.max = String(max)
  }
}

/**
 * Wraps a control in its label, which both names it and adopts it — the
 * control becomes a child, so the whole row is a hit target.
 * @param formControl - The control to name and adopt.
 * @param text - The visible label text.
 * @param className - The page's label class, omitted by bare-element pages.
 * @returns The label, control inside.
 * @category DOM
 */
export const createLabel = (
  formControl: HTMLValueElement,
  text: string,
  className?: string,
): HTMLLabelElement => {
  const label = document.createElement('label')
  applyClassName(label, className)
  label.htmlFor = formControl.id
  label.textContent = text
  label.append(formControl)
  return label
}

/**
 * Builds a form input. The value is assigned before the type, preserving
 * the reference order: browsers sanitize a value against the type in
 * force, so swapping the two can silently blank a numeric field.
 * @param options - What the input is and starts as.
 * @returns The configured input, not yet in the document.
 * @category DOM
 */
export const createInput = (options: CreateInputOptions): HTMLInputElement => {
  const { className, id, max, min, placeholder, type, value } = options
  const input = document.createElement('input')
  applyClassName(input, className)
  input.id = id
  input.value = value ?? ''
  input.type = type
  configureNumericInput(input, { max, min })
  if (placeholder !== undefined) {
    input.placeholder = placeholder
  }
  return input
}

/**
 * Builds a select, prefixed with the empty entry that lets a grouped
 * form show "no common value" without inventing one.
 * @param id - The element id, which its label points at.
 * @param values - The entries, in display order.
 * @param className - The page's select class, omitted by bare-element pages.
 * @returns The populated select, not yet in the document.
 * @category DOM
 */
export const createSelect = (
  id: string,
  values: readonly SelectOption[],
  className?: string,
): HTMLSelectElement => {
  const select = document.createElement('select')
  applyClassName(select, className)
  select.id = id
  for (const option of [{ id: '', label: '' }, ...values]) {
    createOption(select, option)
  }
  return select
}

/**
 * Reads a form control as the domain value it carries: a checkbox as a
 * tri-state boolean (`null` while indeterminate), a bounded number input
 * through the caller's number strategy (a settings page throws on an
 * out-of-range value, a widget clamps it), a boolean string as a
 * boolean, and anything else as a number when finite, else the raw
 * string. An empty value reads as `null` — "no instruction", never an
 * empty-string write.
 * @param element - The control to read.
 * @param parseNumber - The bounded-number strategy; omitted by pages
 * without bounded numeric inputs, whose values take the plain read.
 * @returns The value, typed by what the control carries.
 * @category DOM
 */
export const parseFormValue = (
  element: HTMLValueElement,
  parseNumber?: (input: HTMLInputElement) => number,
): boolean | number | string | null => {
  if (element.value !== '') {
    if (element.type === 'checkbox') {
      return element.indeterminate ? null : element.checked
    }
    if (
      parseNumber !== undefined &&
      element.type === 'number' &&
      element.min !== '' &&
      element.max !== ''
    ) {
      return parseNumber(element)
    }
    if (booleanStrings.includes(element.value)) {
      return element.value === 'true'
    }
    const numberValue = Number(element.value)
    return Number.isFinite(numberValue) ? numberValue : element.value
  }
  return null
}
