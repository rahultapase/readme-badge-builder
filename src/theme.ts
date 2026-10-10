export type ThemeChoice = 'system' | 'light' | 'dark'

/** Must match the inline script in index.html that applies the theme before first paint. */
const STORAGE_KEY = 'rbb-theme'

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark'
}

function readStored(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isThemeChoice(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = choice
  try {
    if (choice === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this visit.
  }
}

/** Wire the radio group `name="theme"` to the document theme. */
export function initTheme(): void {
  const current = readStored()
  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="theme"]')) {
    radio.checked = radio.value === current
    radio.addEventListener('change', () => {
      if (radio.checked && isThemeChoice(radio.value)) apply(radio.value)
    })
  }
}
