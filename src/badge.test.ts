import { describe, expect, it } from 'vitest'
import {
  buildBadge,
  buildStaticUrl,
  escapeSegment,
  normalizeLink,
  normalizeLogo,
  toHtml,
  toMarkdown,
  type BadgeInput,
} from './badge'

const base: BadgeInput = {
  label: 'hacktoberfest',
  message: '2026',
  color: 'orange',
  labelColor: '',
  style: 'flat',
  logo: '',
  logoColor: '',
  link: '',
}

function urlFor(overrides: Partial<BadgeInput>): string {
  const result = buildBadge({ ...base, ...overrides })
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.badge.url
}

describe('escapeSegment', () => {
  it.each([
    ['my-app', 'my--app'],
    ['snake_case', 'snake__case'],
    ['hello world', 'hello_world'],
    ['95%', '95%25'],
    ['a/b', 'a%2Fb'],
    ['C#', 'C%23'],
    ['café', 'caf%C3%A9'],
    ['  padded  ', 'padded'],
    ['multi   space', 'multi_space'],
    ['a-b_c d', 'a--b__c_d'],
    ['(beta)', '%28beta%29'],
    ['what?', 'what%3F'],
  ])('%s → %s', (input, expected) => {
    expect(escapeSegment(input)).toBe(expected)
  })
})

describe('buildStaticUrl', () => {
  it('builds label-message-color', () => {
    expect(buildStaticUrl({ label: 'build', message: 'passing', color: 'brightgreen', style: 'flat' })).toBe(
      'https://img.shields.io/badge/build-passing-brightgreen',
    )
  })

  it('uses message-color when the label is empty', () => {
    expect(buildStaticUrl({ label: '  ', message: 'just text', color: '8a2be2', style: 'flat' })).toBe(
      'https://img.shields.io/badge/just_text-8a2be2',
    )
  })

  it('adds only non-default query params', () => {
    expect(
      buildStaticUrl({
        label: 'made with',
        message: 'TypeScript',
        color: '3178c6',
        style: 'for-the-badge',
        logo: 'typescript',
        logoColor: 'white',
        labelColor: '555555',
      }),
    ).toBe(
      'https://img.shields.io/badge/made_with-TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=555555',
    )
  })

  it('encodes functional colors in the path', () => {
    expect(buildStaticUrl({ label: 'a', message: 'b', color: 'rgb(1,2,3)', style: 'flat' })).toBe(
      'https://img.shields.io/badge/a-b-rgb%281%2C2%2C3%29',
    )
  })
})

describe('buildBadge', () => {
  it('strips # from hex colors', () => {
    expect(urlFor({ color: '#FF6600' })).toBe('https://img.shields.io/badge/hacktoberfest-2026-ff6600')
  })

  it('requires a message', () => {
    const result = buildBadge({ ...base, message: '   ' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.message).toBeTruthy()
  })

  it('rejects unknown colors', () => {
    const result = buildBadge({ ...base, color: 'notacolor' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.color).toBeTruthy()
  })

  it('treats optional colors as optional but still validates them', () => {
    expect(urlFor({ labelColor: '', logoColor: '' })).not.toContain('Color=')
    const result = buildBadge({ ...base, labelColor: 'nope!' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(['labelColor'])
  })

  it('collects several errors at once', () => {
    const result = buildBadge({ ...base, message: '', color: '', logo: 'Not A Slug', link: 'javascript:alert(1)' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['color', 'link', 'logo', 'message'])
  })

  it('builds alt text from label and message', () => {
    const result = buildBadge({ ...base, label: '', message: 'PRs welcome' })
    expect(result.ok && result.badge.alt).toBe('PRs welcome')
  })
})

describe('normalizeLogo', () => {
  it('lowercases valid slugs', () => {
    expect(normalizeLogo(' GitHubCopilot ')).toEqual({ ok: true, value: 'githubcopilot' })
  })

  it('rejects spaces and symbols', () => {
    expect(normalizeLogo('node.js').ok).toBe(false)
    expect(normalizeLogo('git hub').ok).toBe(false)
  })
})

describe('normalizeLink', () => {
  it.each(['LICENSE', './CONTRIBUTING.md', '#install', 'docs/setup.md'])('accepts relative path %s', (link) => {
    expect(normalizeLink(link)).toEqual({ ok: true, value: link })
  })

  it('normalizes absolute URLs', () => {
    expect(normalizeLink('https://example.com/a b')).toEqual({ ok: true, value: 'https://example.com/a%20b' })
  })

  it.each(['javascript:alert(1)', 'data:text/html,hi', '//evil.example', 'mailto:me@example.com', 'has space'])(
    'rejects %s',
    (link) => {
      expect(normalizeLink(link).ok).toBe(false)
    },
  )
})

describe('snippets', () => {
  const badge = { url: 'https://img.shields.io/badge/a-b-blue', alt: 'docs [beta]: <ok> & "fine"', link: null }

  it('escapes brackets in Markdown alt text', () => {
    expect(toMarkdown(badge)).toBe('![docs \\[beta\\]: <ok> & "fine"](https://img.shields.io/badge/a-b-blue)')
  })

  it('wraps Markdown in a link', () => {
    expect(toMarkdown({ ...badge, alt: 'license: MIT', link: 'LICENSE' })).toBe(
      '[![license: MIT](https://img.shields.io/badge/a-b-blue)](LICENSE)',
    )
  })

  it('escapes HTML attributes', () => {
    expect(toHtml(badge)).toBe(
      '<img alt="docs [beta]: &lt;ok&gt; &amp; &quot;fine&quot;" src="https://img.shields.io/badge/a-b-blue">',
    )
  })

  it('wraps HTML in a link', () => {
    expect(toHtml({ ...badge, alt: 'x', link: 'https://example.com/' })).toBe(
      '<a href="https://example.com/"><img alt="x" src="https://img.shields.io/badge/a-b-blue"></a>',
    )
  })
})
