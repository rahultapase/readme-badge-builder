import '@fontsource-variable/schibsted-grotesk'
import '@fontsource-variable/martian-mono/standard.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'

import {
  BADGE_STYLES,
  buildBadge,
  toHtml,
  toMarkdown,
  type Badge,
  type BadgeField,
  type BadgeInput,
  type BadgeStyle,
  type FieldErrors,
} from './badge'
import { COPY_SHORTCUT, copyText, selectContents } from './clipboard'
import { toPickerHex } from './colors'
import { hydrateIcons } from './icons'
import { DEFAULT_INPUT, PRESETS } from './presets'
import { initTheme } from './theme'

type TextField = Exclude<BadgeField, 'style'>
type ColorField = 'color' | 'labelColor' | 'logoColor'
type Format = 'markdown' | 'html' | 'url'

const TEXT_FIELDS: readonly TextField[] = ['label', 'message', 'color', 'labelColor', 'logo', 'logoColor', 'link']
const COLOR_FIELDS: readonly ColorField[] = ['color', 'labelColor', 'logoColor']
const FORMAT_LABEL: Record<Format, string> = { markdown: 'Markdown', html: 'HTML', url: 'URL' }
const STYLE_LABEL: Record<BadgeStyle, string> = {
  flat: 'Flat',
  'flat-square': 'Flat square',
  plastic: 'Plastic',
  'for-the-badge': 'For the badge',
  social: 'Social',
}

const PREVIEW_DELAY_MS = 250
const COPIED_MS = 1600
const STATUS_CLEAR_MS = 4000
const LOUPE_SCALE = 4
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function el<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector)
  if (!node) throw new Error(`Missing element: ${selector}`)
  return node
}

const inputs = Object.fromEntries(
  TEXT_FIELDS.map((field) => [field, el<HTMLInputElement>(`#field-${field}`)]),
) as Record<TextField, HTMLInputElement>

const pickers = Object.fromEntries(
  COLOR_FIELDS.map((field) => [field, el<HTMLInputElement>(`#picker-${field}`)]),
) as Record<ColorField, HTMLInputElement>

const ui = {
  form: el<HTMLFormElement>('#badge-form'),
  presets: el<HTMLDivElement>('#presets'),
  styles: el<HTMLDivElement>('#styles'),
  reset: el<HTMLButtonElement>('#reset-button'),
  loupeMat: el<HTMLDivElement>('#loupe-mat'),
  loupeImg: el<HTMLImageElement>('#loupe-img'),
  previewStatus: el<HTMLDivElement>('#preview-status'),
  code: el<HTMLElement>('#output-code'),
  note: el<HTMLParagraphElement>('#output-note'),
  copy: el<HTMLButtonElement>('#copy-button'),
  copyLabel: el<HTMLSpanElement>('#copy-label'),
  copyStatus: el<HTMLParagraphElement>('#copy-status'),
}

let state: BadgeInput = { ...DEFAULT_INPUT }
let format: Format = 'markdown'
let lastValid: { badge: Badge; input: BadgeInput } | null = null
let shownUrl = ''
let previewTimer: number | undefined
let previewToken = 0
let copiedTimer: number | undefined
let statusTimer: number | undefined
const touched = new Set<BadgeField>()
const styleImages = new Map<BadgeStyle, HTMLImageElement>()

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function snippet(badge: Badge): string {
  if (format === 'markdown') return toMarkdown(badge)
  if (format === 'html') return toHtml(badge)
  return badge.url
}

function renderErrors(errors: FieldErrors): void {
  for (const node of document.querySelectorAll<HTMLElement>('[data-error-for]')) {
    const field = node.dataset.errorFor as TextField
    const message = errors[field]
    const visible = Boolean(message) && touched.has(field)
    node.textContent = visible ? (message ?? '') : ''
    if (visible) inputs[field].setAttribute('aria-invalid', 'true')
    else inputs[field].removeAttribute('aria-invalid')
  }
}

function renderOutput(): void {
  ui.copyLabel.textContent = `Copy ${FORMAT_LABEL[format]}`
  if (lastValid) ui.code.textContent = snippet(lastValid.badge)
}

function render(options: { immediate?: boolean } = {}): void {
  const result = buildBadge(state)
  renderErrors(result.ok ? {} : result.errors)
  ui.note.hidden = result.ok

  if (result.ok) {
    lastValid = { badge: result.badge, input: { ...state } }
    renderOutput()
    schedulePreview(options.immediate ?? false)
  }
}

function syncSwatch(field: ColorField): void {
  const swatch = el<HTMLSpanElement>(`[data-swatch-for="${field}"]`)
  const hex = toPickerHex(state[field])
  swatch.toggleAttribute('data-empty', hex === null)
  swatch.style.setProperty('--swatch', hex ?? 'transparent')
  if (hex) pickers[field].value = hex
}

function writeForm(): void {
  for (const field of TEXT_FIELDS) inputs[field].value = state[field]
  for (const field of COLOR_FIELDS) syncSwatch(field)
  for (const radio of ui.styles.querySelectorAll<HTMLInputElement>('input[name="style"]')) {
    radio.checked = radio.value === state.style
  }
}

// ---------------------------------------------------------------------------
// Preview (debounced, double-buffered so the badge never flickers)
// ---------------------------------------------------------------------------

function schedulePreview(immediate: boolean): void {
  window.clearTimeout(previewTimer)
  if (immediate) void updatePreview()
  else previewTimer = window.setTimeout(() => void updatePreview(), PREVIEW_DELAY_MS)
}

function setPreviewStatus(message: string): void {
  ui.previewStatus.textContent = message
  ui.previewStatus.toggleAttribute('data-visible', message !== '')
}

async function updatePreview(): Promise<void> {
  if (!lastValid) return
  const { badge, input } = lastValid
  updateStyleTiles(input)
  if (badge.url === shownUrl) return

  const token = ++previewToken
  const probe = new Image()
  probe.src = badge.url
  try {
    await probe.decode()
  } catch {
    if (token !== previewToken) return
    ui.loupeMat.classList.remove('is-loading')
    ui.loupeMat.classList.add('has-error')
    setPreviewStatus("Couldn't load the preview from shields.io. Your code below is still valid.")
    return
  }
  if (token !== previewToken) return

  shownUrl = badge.url
  ui.loupeMat.classList.remove('is-loading', 'has-error')
  setPreviewStatus('')

  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-preview]')) {
    img.src = badge.url
  }

  const { loupeImg } = ui
  loupeImg.src = badge.url
  loupeImg.alt = `Badge preview: ${badge.alt}`
  if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
    loupeImg.width = probe.naturalWidth * LOUPE_SCALE
    loupeImg.height = probe.naturalHeight * LOUPE_SCALE
  }

  const frames: Keyframe[] = reducedMotion.matches
    ? [{ opacity: 0.6 }, { opacity: 1 }]
    : [
        { opacity: 0.5, filter: 'blur(2px)', transform: 'scale(0.985)' },
        { opacity: 1, filter: 'blur(0)', transform: 'none' },
      ]
  loupeImg.animate(frames, { duration: 180, easing: EASE_OUT })
}

function updateStyleTiles(input: BadgeInput): void {
  for (const style of BADGE_STYLES) {
    const result = buildBadge({ ...input, style })
    const img = styleImages.get(style)
    if (result.ok && img && img.src !== result.badge.url) img.src = result.badge.url
  }
}

// ---------------------------------------------------------------------------
// Static UI built from data
// ---------------------------------------------------------------------------

function buildPresets(): void {
  for (const preset of PRESETS) {
    const result = buildBadge(preset.input)
    if (!result.ok) continue

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'preset'

    const prefix = document.createElement('span')
    prefix.className = 'visually-hidden'
    prefix.textContent = 'Use preset '

    const img = document.createElement('img')
    img.src = result.badge.url
    img.alt = result.badge.alt
    img.height = 20
    img.decoding = 'async'

    button.append(prefix, img)
    button.addEventListener('click', () => loadInput(preset.input))
    ui.presets.append(button)
  }
}

function buildStylePicker(): void {
  for (const style of BADGE_STYLES) {
    const label = document.createElement('label')
    label.className = 'style-option'

    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = 'style'
    radio.value = style
    radio.className = 'visually-hidden'
    radio.addEventListener('change', () => {
      if (!radio.checked) return
      state.style = style
      render({ immediate: true })
    })

    const face = document.createElement('span')
    face.className = 'style-option__face'

    const preview = document.createElement('span')
    preview.className = 'style-option__preview'
    const img = document.createElement('img')
    img.alt = ''
    img.decoding = 'async'
    preview.append(img)
    styleImages.set(style, img)

    const name = document.createElement('span')
    name.className = 'style-option__name'
    name.textContent = STYLE_LABEL[style]

    face.append(preview, name)
    label.append(radio, face)
    ui.styles.append(label)
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function loadInput(input: BadgeInput): void {
  state = { ...input }
  touched.clear()
  writeForm()
  render({ immediate: true })
}

function isColorField(field: TextField): field is ColorField {
  return (COLOR_FIELDS as readonly string[]).includes(field)
}

function bindFields(): void {
  for (const field of TEXT_FIELDS) {
    const input = inputs[field]
    input.addEventListener('input', () => {
      state[field] = input.value
      if (isColorField(field)) syncSwatch(field)
      render()
    })
    input.addEventListener('blur', () => {
      if (touched.has(field)) return
      touched.add(field)
      render()
    })
  }

  for (const field of COLOR_FIELDS) {
    pickers[field].addEventListener('input', () => {
      state[field] = pickers[field].value
      inputs[field].value = state[field]
      syncSwatch(field)
      render()
    })
  }

  // Enter in a text field shouldn't reload the page.
  ui.form.addEventListener('submit', (event) => event.preventDefault())
  ui.reset.addEventListener('click', () => loadInput(DEFAULT_INPUT))

  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="format"]')) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return
      format = radio.value as Format
      renderOutput()
    })
  }

  ui.copy.addEventListener('click', () => void handleCopy())
}

function announce(message: string): void {
  window.clearTimeout(statusTimer)
  ui.copyStatus.textContent = message
  statusTimer = window.setTimeout(() => {
    ui.copyStatus.textContent = ''
  }, STATUS_CLEAR_MS)
}

async function handleCopy(): Promise<void> {
  if (!lastValid) return
  const label = FORMAT_LABEL[format]
  const copied = await copyText(snippet(lastValid.badge))

  if (copied) {
    window.clearTimeout(copiedTimer)
    ui.copy.dataset.state = 'copied'
    copiedTimer = window.setTimeout(() => delete ui.copy.dataset.state, COPIED_MS)
    announce(`${label} copied to clipboard.`)
  } else {
    selectContents(ui.code)
    announce(`Copy is blocked here. The ${label} is selected, so press ${COPY_SHORTCUT}.`)
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

hydrateIcons()
initTheme()
buildPresets()
buildStylePicker()
bindFields()
writeForm()
render({ immediate: true })
