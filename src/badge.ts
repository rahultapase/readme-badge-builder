/**
 * Pure helpers that turn form input into shields.io badge URLs and
 * README snippets. No DOM access, so everything here is unit-tested.
 */
import { normalizeColor } from './colors'

export const BADGE_STYLES = ['flat', 'flat-square', 'plastic', 'for-the-badge', 'social'] as const
export type BadgeStyle = (typeof BADGE_STYLES)[number]

export interface BadgeInput {
  label: string
  message: string
  color: string
  labelColor: string
  style: BadgeStyle
  logo: string
  logoColor: string
  link: string
}

export type BadgeField = keyof BadgeInput
export type FieldErrors = Partial<Record<BadgeField, string>>

export interface Badge {
  url: string
  alt: string
  link: string | null
}

export type BuildResult = { ok: true; badge: Badge } | { ok: false; errors: FieldErrors }

const SHIELDS_BADGE_BASE = 'https://img.shields.io/badge/'

/** encodeURIComponent, plus the characters it leaves alone that can break Markdown links. */
export function strictEncode(text: string): string {
  return encodeURIComponent(text).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

function tidy(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/**
 * Escape one label/message segment using shields.io's static badge rules:
 * `-` → `--`, `_` → `__`, space → `_`, then percent-encode the rest.
 */
export function escapeSegment(text: string): string {
  const escaped = tidy(text).replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_')
  return strictEncode(escaped)
}

export interface StaticBadgeParts {
  label: string
  message: string
  /** Already normalized via normalizeColor. */
  color: string
  style: BadgeStyle
  logo?: string
  logoColor?: string
  labelColor?: string
}

export function buildStaticUrl(parts: StaticBadgeParts): string {
  const message = escapeSegment(parts.message)
  const color = strictEncode(parts.color)
  const label = tidy(parts.label)
  const path = label ? `${escapeSegment(label)}-${message}-${color}` : `${message}-${color}`

  const params = new URLSearchParams()
  if (parts.style !== 'flat') params.set('style', parts.style)
  if (parts.logo) params.set('logo', parts.logo)
  if (parts.logoColor) params.set('logoColor', parts.logoColor)
  if (parts.labelColor) params.set('labelColor', parts.labelColor)

  const query = params.toString()
  return SHIELDS_BADGE_BASE + path + (query ? `?${query}` : '')
}

export function altText(label: string, message: string): string {
  const l = tidy(label)
  const m = tidy(message)
  return l ? `${l}: ${m}` : m
}

type Normalized = { ok: true; value: string } | { ok: false; error: string }

/** Simple Icons slugs are lowercase letters and digits, e.g. `githubcopilot`. */
export function normalizeLogo(raw: string): Normalized {
  const value = raw.trim().toLowerCase()
  if (!value || /^[a-z0-9]+$/.test(value)) return { ok: true, value }
  return {
    ok: false,
    error: 'Use a Simple Icons name: lowercase letters and numbers, like githubcopilot.',
  }
}

const RELATIVE_LINK = /^[A-Za-z0-9._~/#?=&%+-]+$/

/**
 * Accepts absolute http(s) URLs or README-relative paths (LICENSE, ./docs/x.md, #install).
 * Anything with another scheme (javascript:, data:) is rejected.
 */
export function normalizeLink(raw: string): Normalized {
  const value = raw.trim()
  if (!value) return { ok: true, value: '' }

  const error = 'Use a full https:// link or a relative path like LICENSE.'

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error }
      return { ok: true, value: url.href.replace(/\(/g, '%28').replace(/\)/g, '%29') }
    } catch {
      return { ok: false, error }
    }
  }

  if (value.includes(':') || value.startsWith('//') || !RELATIVE_LINK.test(value)) {
    return { ok: false, error }
  }
  return { ok: true, value }
}

/** Validate every field and build the badge, or return per-field errors. */
export function buildBadge(input: BadgeInput): BuildResult {
  const errors: FieldErrors = {}

  if (!tidy(input.message)) {
    errors.message = "Add a message. It's the right side of the badge."
  }

  const color = normalizeColor(input.color)
  if (!color.ok) errors.color = color.error

  const optionalColor = (field: 'labelColor' | 'logoColor'): string => {
    if (!input[field].trim()) return ''
    const result = normalizeColor(input[field])
    if (result.ok) return result.value
    errors[field] = result.error
    return ''
  }
  const labelColor = optionalColor('labelColor')
  const logoColor = optionalColor('logoColor')

  const logo = normalizeLogo(input.logo)
  if (!logo.ok) errors.logo = logo.error

  const link = normalizeLink(input.link)
  if (!link.ok) errors.link = link.error

  if (Object.keys(errors).length > 0 || !color.ok || !logo.ok || !link.ok) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    badge: {
      url: buildStaticUrl({
        label: input.label,
        message: input.message,
        color: color.value,
        style: input.style,
        logo: logo.value,
        logoColor,
        labelColor,
      }),
      alt: altText(input.label, input.message),
      link: link.value || null,
    },
  }
}

function escapeMarkdownText(text: string): string {
  return text.replace(/[\\[\]]/g, '\\$&')
}

function escapeHtmlAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function toMarkdown(badge: Badge): string {
  const image = `![${escapeMarkdownText(badge.alt)}](${badge.url})`
  return badge.link ? `[${image}](${badge.link})` : image
}

export function toHtml(badge: Badge): string {
  const image = `<img alt="${escapeHtmlAttribute(badge.alt)}" src="${escapeHtmlAttribute(badge.url)}">`
  return badge.link ? `<a href="${escapeHtmlAttribute(badge.link)}">${image}</a>` : image
}
