import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const css = readFileSync('app/globals.css', 'utf8')

export const GRADIENT = /linear-gradient|radial-gradient|conic-gradient/

/** Drop mask declarations: a gradient there is an alpha channel, not paint. */
export function withoutMasks(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/(^|[^-\w])(-webkit-)?mask-image\s*:/.test(line))
    .join('\n')
}

/** Drop comments, so prose about a decision never satisfies or trips an assertion. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Drop `@keyframes` bodies: their `opacity: 0` is a start frame, not a resting state. */
function withoutKeyframes(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const at = source.indexOf('@keyframes', i)
    if (at === -1) return out + source.slice(i)
    out += source.slice(i, at)
    let depth = 1
    let j = source.indexOf('{', at) + 1
    while (j < source.length && depth > 0) {
      if (source[j] === '{') depth++
      else if (source[j] === '}') depth--
      j++
    }
    i = j
  }
  return out
}

/** Top-level `@media` blocks as `{ condition, body }`, matched by brace depth. */
function mediaBlocks(source: string): { condition: string; body: string }[] {
  const out: { condition: string; body: string }[] = []
  const open = /@media([^{]+)\{/g
  let match: RegExpExecArray | null
  while ((match = open.exec(source))) {
    let depth = 1
    let i = open.lastIndex
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') depth--
      i++
    }
    out.push({ condition: match[1].trim(), body: source.slice(open.lastIndex, i - 1) })
    open.lastIndex = i
  }
  return out
}

/** Every `selector { … }` rule, flat. Nested at-rule bodies are walked into. */
function rules(source: string): { selector: string; body: string }[] {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }))
}

/** Relative luminance, WCAG 2.1. */
function lum(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const l = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

const CREAM = '#F7EFE1'
const GRAPHITE = '#1C1A19'
const INDIGO = '#4433D6'
const EMBER = '#EE4E22'
const DARK_GROUND = '#1B1D1F'
const DARK_INK = '#EDEBE4'
const DARK_ACCENT = '#FF6B2C'

describe('brand tokens', () => {
  it('declares every locked token verbatim', () => {
    for (const hex of [CREAM, GRAPHITE, INDIGO, EMBER, DARK_GROUND, DARK_INK, DARK_ACCENT]) {
      expect(css).toContain(hex)
    }
  })

  it('never PAINTS a gradient', () => {
    // The rule is "no visible colour gradients": they date fast and read as an AI product.
    // A gradient used as a `mask-image` is an alpha channel, not paint. It fades the edge
    // of the drifting language reels and never puts a colour ramp on screen, so mask
    // declarations are excluded. Everything that could actually paint is still banned.
    expect(withoutMasks(css)).not.toMatch(GRADIENT)
  })

  it('only ever uses a gradient inside a mask declaration', () => {
    for (const line of css.split('\n').filter((l) => /-gradient\(/.test(l))) {
      expect(line, `gradient outside a mask: ${line.trim()}`).toMatch(/mask-image\s*:/)
    }
  })
})

describe('measured contrast — the rules follow from these numbers', () => {
  it('graphite passes AA for body text on cream', () => {
    expect(ratio(GRAPHITE, CREAM)).toBeGreaterThanOrEqual(4.5)
  })

  it('indigo passes AA for body text on cream, so it can carry links', () => {
    expect(ratio(INDIGO, CREAM)).toBeGreaterThanOrEqual(4.5)
  })

  it('ember FAILS body text on cream — this is why it is fill-only', () => {
    expect(ratio(EMBER, CREAM)).toBeLessThan(4.5)
  })

  it('ember still passes for large text and UI, so buttons are legitimate', () => {
    expect(ratio(EMBER, CREAM)).toBeGreaterThanOrEqual(3)
  })

  it('cream on ember passes for large text, so ember buttons can carry a label', () => {
    expect(ratio(CREAM, EMBER)).toBeGreaterThanOrEqual(3)
  })

  it('bone on the dark ground passes AA', () => {
    expect(ratio(DARK_INK, DARK_GROUND)).toBeGreaterThanOrEqual(4.5)
  })

  it('the dark accent passes AA as text, which is why dark sections exist', () => {
    expect(ratio(DARK_ACCENT, DARK_GROUND)).toBeGreaterThanOrEqual(4.5)
  })

  it('indigo would FAIL on the dark ground — hence the never-on-dark rule', () => {
    expect(ratio(INDIGO, DARK_GROUND)).toBeLessThan(4.5)
  })
})

describe('reveal animations must never strand content invisible', () => {
  it('only applies the rise animation under .js-motion, so no-JS renders visible', () => {
    // A bare `.reveal { animation: rise ... }` rule would leave every wrapped section at
    // opacity 0 when JavaScript is unavailable. The animation must be scoped to the class
    // that an inline script adds.
    const revealRules = css.match(/^[^\n]*\.reveal[^\n]*\{/gm) ?? []
    expect(revealRules.length).toBeGreaterThan(0)
    for (const rule of revealRules) {
      expect(rule, `unscoped reveal rule: ${rule}`).toContain('.js-motion')
    }
  })

  it('declares no animation-timeline', () => {
    // Native scroll-driven animation was observed pinning reveals at negative timeline
    // progress (permanently opacity 0). IntersectionObserver drives them instead.
    // Comments are stripped so prose about the decision doesn't trip the assertion.
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).not.toMatch(/animation-timeline\s*:/)
  })

  it('never leaves an element at rest opacity 0 outside .js-motion', () => {
    // The general form of the reveal rule above. Any resting `opacity: 0` that JavaScript
    // has not opted into is a section a no-JS visitor cannot read. Keyframe start frames
    // are excluded: they are not resting states, and the reduced-motion duration collapse
    // lands `both`-filled animations on their end frame.
    const source = withoutKeyframes(withoutComments(css))
    const zeroed = rules(source).filter((r) => /(^|[^-\w])opacity:\s*0\s*(;|$)/.test(r.body))

    expect(zeroed.length).toBeGreaterThan(0)
    for (const rule of zeroed) {
      expect(rule.selector, `unscoped opacity: 0 — "${rule.selector}"`).toContain('.js-motion')
    }
  })

  it('confines the mobile per-item reveal to below the pinning breakpoint', () => {
    // `.pin-item` crossfades via an opacity TRANSITION when the desktop pin is running. An
    // opacity animation on the same element wins the cascade and breaks the pin, so every
    // `.pin-reveal` rule has to sit inside a max-width query. Counting occurrences rather
    // than spot-checking means a rule added outside any query still fails.
    const source = withoutComments(css)
    const total = (source.match(/\.pin-reveal/g) ?? []).length
    const scoped = mediaBlocks(source)
      .filter((block) => /max-width:\s*767px/.test(block.condition))
      .reduce((n, block) => n + (block.body.match(/\.pin-reveal/g) ?? []).length, 0)

    expect(total).toBeGreaterThan(0)
    expect(scoped, 'a .pin-reveal rule escaped the max-width: 767px query').toBe(total)
  })

  it('keeps the mobile reveal out of the way of reduced motion', () => {
    const mobileReveal = mediaBlocks(withoutComments(css)).filter((block) =>
      block.body.includes('.pin-reveal'),
    )
    expect(mobileReveal.length).toBeGreaterThan(0)
    for (const block of mobileReveal) {
      expect(block.condition, `.pin-reveal ignores motion preference: ${block.condition}`).toMatch(
        /prefers-reduced-motion:\s*no-preference/,
      )
    }
  })

  it('keeps reduced-motion durations collapsed rather than removed', () => {
    // `animation: none` would discard the `both` fill and could strand the from-state.
    expect(css).toMatch(/prefers-reduced-motion/)
    expect(css).toMatch(/animation-duration:\s*0\.001ms/)
  })
})
