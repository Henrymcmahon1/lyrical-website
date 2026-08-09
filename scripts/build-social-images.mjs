/**
 * Build `public/og.png`, the link preview card.
 *
 * Every link to this site shared anywhere, LinkedIn, Slack, WhatsApp, iMessage, renders as a
 * bare grey rectangle without it. The brand kit already generated an equivalent, but into
 * `brand-kit/social/`, which is a shareable folder rather than something the site serves, so
 * the tag had nothing to point at.
 *
 * Built the same way as the rest of the kit: mark geometry from `lib/mark.ts`, the real
 * self-hosted fonts, rendered in a real browser. Nothing hand-drawn, so it cannot drift from
 * the live site.
 *
 * Committed to git ON PURPOSE, unlike the /listen audio. It is generated from our own
 * geometry, contains no third-party material, and it has to survive a deployment made from
 * somewhere other than this working directory.
 *
 *   npx tsx scripts/build-social-images.mjs
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { toPath } from '../lib/mark.ts'
import { APPROX } from '../lib/mark-states.ts'

const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

const C = { cream: '#F7EFE1', graphite: '#1C1A19', indigo: '#4433D6' }
const W = 1200
const H = 630

const fraunces = readFileSync('public/fonts/Fraunces.woff2').toString('base64')
const archivo = readFileSync('public/fonts/Archivo.woff2').toString('base64')
const FONTS = `
  @font-face{font-family:'Fraunces Kit';src:url(data:font/woff2;base64,${fraunces}) format('woff2');font-weight:100 900;}
  @font-face{font-family:'Archivo Kit';src:url(data:font/woff2;base64,${archivo}) format('woff2');font-weight:100 900;}
`

const body = `
  <div style="width:100%;height:100%;background:${C.cream};display:flex;flex-direction:column;justify-content:center;padding:0 92px;gap:36px;">
    <svg viewBox="0 0 64 64" width="96" height="96">
      <path d="${TOP}" fill="${C.indigo}"/><path d="${BOTTOM}" fill="${C.indigo}"/>
    </svg>
    <div style="font-family:'Fraunces Kit',Georgia,serif;font-weight:600;font-size:66px;line-height:1.08;color:${C.graphite};letter-spacing:-1.2px;">
      Every song. Any language.<br/>Same soul.
    </div>
    <div style="font-family:'Archivo Kit',system-ui,sans-serif;font-size:24px;line-height:1.5;color:${C.graphite};opacity:.7;max-width:820px;">
      Authorized versions of finished records, in the artist&rsquo;s own voice.
    </div>
  </div>`

const browser = await chromium.launch()
const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage()
await page.setViewportSize({ width: W, height: H })
await page.setContent(
  `<style>${FONTS}*{margin:0;padding:0;box-sizing:border-box}body{width:${W}px;height:${H}px;overflow:hidden}</style>${body}`,
  { waitUntil: 'load' },
)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: 'public/og.png', clip: { x: 0, y: 0, width: W, height: H } })
await browser.close()
console.log(`  public/og.png  ${W}x${H}`)
