/**
 * Build `public/brand/lyrical-email.png`, the lockup that sits at the top of every email.
 *
 *   npx tsx scripts/build-email-logo.mjs
 *
 * Built the same way as the rest of the kit: mark geometry from `lib/mark.ts`, the real
 * self-hosted Fraunces, rendered in a real browser. Nothing hand-drawn, so it cannot drift from
 * the live site. Committed to git on purpose, because it has to survive a deployment made from
 * somewhere other than this working directory and because the emails fetch it over HTTP.
 *
 * ## Why a PNG and not the SVG the site uses
 *
 * Gmail strips inline `<svg>` entirely and Outlook has never supported it, so the mark would
 * simply vanish for most of the people receiving these. A raster image is the only thing that
 * renders everywhere, which is the same constraint that shapes the rest of `email-shell.ts`.
 *
 * ## Why it has a cream background baked in
 *
 * An email cannot do dark mode: no `<head>` for `color-scheme`, and Gmail strips `<style>`, so
 * no media query. A transparent logo therefore becomes an indigo mark on whatever ground the
 * client decides to use, which in a dark client is close to invisible. Painting the cream in
 * means it always sits on the surface it was designed for. Same lesson as the Zoho signature,
 * recorded in HANDOVER 4b, and the reason that logo is white-backed rather than transparent.
 *
 * ⚠️ It is NOT white-backed like `lyrical-lockup.png`. That one is for Zoho signatures, which
 * sit on white. This one sits on the cream email ground and would show a white box.
 *
 * ## Why it is rendered at 3x
 *
 * The `<img>` is given explicit width and height at the display size, so the extra pixels are
 * there purely so it stays sharp on a phone. Every phone in this audience is retina.
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { toPath } from '../lib/mark.ts'
import { APPROX } from '../lib/mark-states.ts'

const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

const C = { cream: '#F7EFE1', graphite: '#1C1A19', indigo: '#4433D6' }

/** The size the email renders it at. The file is this, multiplied by SCALE. */
export const DISPLAY_W = 132
export const DISPLAY_H = 34
const SCALE = 3

const fraunces = readFileSync('public/fonts/Fraunces.woff2').toString('base64')
const FONTS = `@font-face{font-family:'Fraunces Kit';src:url(data:font/woff2;base64,${fraunces}) format('woff2');font-weight:100 900;}`

/*
 * The horizontal utility lockup, which `components/Wordmark.tsx` documents as the arrangement
 * for "nav bars, email signatures, letterheads, contract headers". The stacked lockup is the
 * primary one and it is wrong here: it doubles the height of every email's header for no gain.
 *
 * Proportions copied from that component rather than invented: mark at 26 against a 24px
 * wordmark, gap of 12, tracking tight, and the trademark at 0.42em raised, because ™ is on the
 * lockup on every page and an email is no different.
 */
const body = `
  <div style="width:${DISPLAY_W}px;height:${DISPLAY_H}px;background:${C.cream};display:flex;align-items:center;gap:9px;">
    <svg viewBox="0 0 64 64" width="26" height="26" style="flex:none;display:block;">
      <path d="${TOP}" fill="${C.indigo}"/><path d="${BOTTOM}" fill="${C.indigo}"/>
    </svg>
    <span style="font-family:'Fraunces Kit',Georgia,serif;font-weight:600;font-size:25px;line-height:1;letter-spacing:-0.5px;color:${C.graphite};white-space:nowrap;">lyrical<span style="font-size:0.42em;vertical-align:super;letter-spacing:normal;margin-left:0.15em;">&trade;</span></span>
  </div>`

mkdirSync('public/brand', { recursive: true })

const browser = await chromium.launch()
const page = await (await browser.newContext({ deviceScaleFactor: SCALE })).newPage()
await page.setViewportSize({ width: DISPLAY_W, height: DISPLAY_H })
await page.setContent(
  `<style>${FONTS}*{margin:0;padding:0;box-sizing:border-box}body{width:${DISPLAY_W}px;height:${DISPLAY_H}px;overflow:hidden;background:${C.cream}}</style>${body}`,
  { waitUntil: 'load' },
)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({
  path: 'public/brand/lyrical-email.png',
  clip: { x: 0, y: 0, width: DISPLAY_W, height: DISPLAY_H },
})
await browser.close()

console.log(
  `  public/brand/lyrical-email.png  ${DISPLAY_W * SCALE}x${DISPLAY_H * SCALE}, shown at ${DISPLAY_W}x${DISPLAY_H}`,
)
