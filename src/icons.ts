/**
 * Phosphor icons (regular weight), imported as raw SVG so only the
 * icons we use end up in the bundle. These strings are trusted build-time
 * assets, never user input.
 */
import arrowCounterClockwise from '@phosphor-icons/core/regular/arrow-counter-clockwise.svg?raw'
import arrowSquareOut from '@phosphor-icons/core/regular/arrow-square-out.svg?raw'
import check from '@phosphor-icons/core/regular/check.svg?raw'
import copy from '@phosphor-icons/core/regular/copy.svg?raw'
import githubLogo from '@phosphor-icons/core/regular/github-logo.svg?raw'
import linkSimple from '@phosphor-icons/core/regular/link-simple.svg?raw'
import monitor from '@phosphor-icons/core/regular/monitor.svg?raw'
import moon from '@phosphor-icons/core/regular/moon.svg?raw'
import sun from '@phosphor-icons/core/regular/sun.svg?raw'
import warningCircle from '@phosphor-icons/core/regular/warning-circle.svg?raw'

const ICONS: Record<string, string> = {
  'arrow-counter-clockwise': arrowCounterClockwise,
  'arrow-square-out': arrowSquareOut,
  check,
  copy,
  'github-logo': githubLogo,
  'link-simple': linkSimple,
  monitor,
  moon,
  sun,
  'warning-circle': warningCircle,
}

function decorate(svg: string): string {
  return svg.replace('<svg ', '<svg class="icon" aria-hidden="true" focusable="false" ')
}

/** Replace every `<span data-icon="name">` with its SVG. */
export function hydrateIcons(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-icon]')) {
    const svg = ICONS[node.dataset.icon ?? '']
    if (svg) node.innerHTML = decorate(svg)
  }
}
