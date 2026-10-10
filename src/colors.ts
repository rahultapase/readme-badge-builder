/**
 * Color handling for shields.io badges.
 *
 * shields.io accepts hex (without '#'), rgb(a)/hsl(a) functions, its own
 * named colors (which differ from CSS for a few names), and CSS named colors.
 */

/** shields.io named colors and their rendered hex values (from badge-maker). */
export const SHIELDS_COLORS: Readonly<Record<string, string>> = {
  brightgreen: '#44cc11',
  green: '#97ca00',
  yellowgreen: '#a4a61d',
  yellow: '#dfb317',
  orange: '#fe7d37',
  red: '#e05d44',
  blue: '#007ec6',
  grey: '#555555',
  gray: '#555555',
  lightgrey: '#9f9f9f',
  lightgray: '#9f9f9f',
  success: '#44cc11',
  important: '#fe7d37',
  critical: '#e05d44',
  informational: '#007ec6',
  inactive: '#9f9f9f',
}

/** The 148 CSS Color Level 4 named colors. */
const CSS_NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
    'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
    'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
    'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
    'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
    'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
    'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
    'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
    'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
    'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
)

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
// No '-' allowed: a dash would collide with the badge path separator.
const COLOR_FUNCTION = /^(rgba?|hsla?)\([\d.%\s,/+]+\)$/i
const WORD = /^[a-z]+$/i

export const COLOR_FORMAT_HINT =
  'Use a hex code like #ff6600, rgb(), hsl(), or a color name like brightgreen.'

export type ColorResult = { ok: true; value: string } | { ok: false; error: string }

/**
 * Normalize a user-entered color into the form shields.io expects
 * (hex without '#', lowercase names, whitespace-free functions).
 * Empty input is an error; callers decide whether a field is optional.
 */
export function normalizeColor(raw: string): ColorResult {
  const value = raw.trim()
  if (!value) return { ok: false, error: 'Add a color, like brightgreen or #ff6600.' }

  const hex = HEX.exec(value)
  if (hex) return { ok: true, value: hex[1].toLowerCase() }

  if (COLOR_FUNCTION.test(value)) {
    return { ok: true, value: value.replace(/\s+/g, '').toLowerCase() }
  }

  if (WORD.test(value)) {
    const name = value.toLowerCase()
    if (name in SHIELDS_COLORS || CSS_NAMED_COLORS.has(name)) return { ok: true, value: name }
  }

  return { ok: false, error: COLOR_FORMAT_HINT }
}

/** Resolves any CSS color string to #rrggbb, or null if it can't. */
export type CssColorResolver = (css: string) => string | null

/**
 * Best-effort `#rrggbb` for an `<input type="color">` swatch.
 * Uses shields.io's own hex for its named colors so the swatch matches the badge.
 */
export function toPickerHex(raw: string, resolve: CssColorResolver = resolveWithCanvas): string | null {
  const result = normalizeColor(raw)
  if (!result.ok) return null
  const value = result.value

  if (value in SHIELDS_COLORS) return SHIELDS_COLORS[value]

  if (/^[0-9a-f]+$/.test(value)) {
    if (value.length === 3 || value.length === 4) {
      return '#' + [...value.slice(0, 3)].map((c) => c + c).join('')
    }
    if (value.length === 6 || value.length === 8) return '#' + value.slice(0, 6)
  }

  return resolve(value)
}

let canvasContext: CanvasRenderingContext2D | null | undefined

function resolveWithCanvas(css: string): string | null {
  if (typeof document === 'undefined') return null
  if (canvasContext === undefined) {
    canvasContext = document.createElement('canvas').getContext('2d')
  }
  if (!canvasContext) return null

  // Assigning an invalid color leaves fillStyle unchanged, so reset first.
  canvasContext.fillStyle = '#000000'
  canvasContext.fillStyle = css
  const resolved = String(canvasContext.fillStyle)
  if (resolved.startsWith('#')) return resolved

  const channels = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(resolved)
  if (!channels) return null
  return (
    '#' +
    channels
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
  )
}
