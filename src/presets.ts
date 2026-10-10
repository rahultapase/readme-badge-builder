import type { BadgeInput } from './badge'

export const EMPTY_INPUT: BadgeInput = {
  label: '',
  message: '',
  color: '',
  labelColor: '',
  style: 'flat',
  logo: '',
  logoColor: '',
  link: '',
}

export interface Preset {
  id: string
  input: BadgeInput
}

function preset(id: string, input: Partial<BadgeInput>): Preset {
  return { id, input: { ...EMPTY_INPUT, ...input } }
}

export const PRESETS: readonly Preset[] = [
  preset('hacktoberfest', {
    label: 'hacktoberfest',
    message: '2026',
    color: 'orange',
    logo: 'github',
    logoColor: 'white',
  }),
  preset('license', { label: 'license', message: 'MIT', color: 'blue', link: 'LICENSE' }),
  preset('prs', { label: 'PRs', message: 'welcome', color: 'brightgreen', link: 'CONTRIBUTING.md' }),
  preset('typescript', {
    label: 'made with',
    message: 'TypeScript',
    color: '#3178c6',
    logo: 'typescript',
    logoColor: 'white',
  }),
  preset('copilot', {
    label: 'built with',
    message: 'GitHub Copilot',
    color: '#000000',
    logo: 'githubcopilot',
    logoColor: 'white',
  }),
]

export const DEFAULT_INPUT: BadgeInput = PRESETS[0].input
