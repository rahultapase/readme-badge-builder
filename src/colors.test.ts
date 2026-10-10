import { describe, expect, it } from 'vitest'
import { normalizeColor, toPickerHex } from './colors'

describe('normalizeColor', () => {
  it.each([
    ['#FF6600', 'ff6600'],
    ['ff6600', 'ff6600'],
    ['#4c1', '4c1'],
    ['#11223344', '11223344'],
    ['brightgreen', 'brightgreen'],
    ['BrightGreen', 'brightgreen'],
    ['rebeccapurple', 'rebeccapurple'],
    ['rgb(1, 2, 3)', 'rgb(1,2,3)'],
    ['hsla(120, 50%, 40%, 0.5)', 'hsla(120,50%,40%,0.5)'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeColor(input)).toEqual({ ok: true, value: expected })
  })

  it.each(['', '   ', 'notacolor', '#12345', 'rgb(1,-2,3)', 'oklch(0.5 0.1 120)', 'currentcolor'])(
    'rejects %j',
    (input) => {
      expect(normalizeColor(input).ok).toBe(false)
    },
  )
})

describe('toPickerHex', () => {
  const noResolver = () => null

  it('uses shields.io hex values for its named colors', () => {
    expect(toPickerHex('brightgreen', noResolver)).toBe('#44cc11')
    expect(toPickerHex('orange', noResolver)).toBe('#fe7d37')
  })

  it('expands short hex and drops alpha', () => {
    expect(toPickerHex('#abc', noResolver)).toBe('#aabbcc')
    expect(toPickerHex('11223344', noResolver)).toBe('#112233')
  })

  it('falls back to the resolver for CSS colors', () => {
    expect(toPickerHex('teal', (css) => (css === 'teal' ? '#008080' : null))).toBe('#008080')
  })

  it('returns null for invalid input', () => {
    expect(toPickerHex('nope!', noResolver)).toBeNull()
  })
})
