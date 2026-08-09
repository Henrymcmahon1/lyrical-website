/**
 * Three candidate LinkedIn company covers, 1128x191.
 *
 * Same construction as the brand kit: the mark comes from `lib/mark.ts`, the type is the
 * real self-hosted Fraunces and Archivo loaded into a real browser. Nothing here is drawn
 * by hand or approximated, so a cover cannot drift from the live site.
 *
 * Rendered at deviceScaleFactor 2, so the files are 2256x382 for the same 1128x191 design.
 * LinkedIn downscales, and a 1x upload reads soft on a retina screen.
 *
 * SAFE AREA. On desktop the company logo tile overlaps the LOWER LEFT of the cover, so
 * every design keeps its content right of about 260px and vertically centred.
 *
 *   npx tsx scripts/build-linkedin-covers.mjs <outDir>
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { toPath } from '../lib/mark.ts'
import { APPROX } from '../lib/mark-states.ts'

const OUT = process.argv[2]
if (!OUT) throw new Error('pass an output directory')
mkdirSync(OUT, { recursive: true })

const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

const C = {
  cream: '#F7EFE1',
  graphite: '#1C1A19',
  indigo: '#4433D6',
  darkGround: '#1B1D1F',
  darkInk: '#EDEBE4',
  darkAccent: '#FF6B2C',
}

const W = 1128
const H = 191

const fraunces = readFileSync('public/fonts/Fraunces.woff2').toString('base64')
const archivo = readFileSync('public/fonts/Archivo.woff2').toString('base64')
const FONTS = `
  @font-face{font-family:'Fraunces Kit';src:url(data:font/woff2;base64,${fraunces}) format('woff2');font-weight:100 900;}
  @font-face{font-family:'Archivo Kit';src:url(data:font/woff2;base64,${archivo}) format('woff2');font-weight:100 900;}
`

const mark = (fill, size, opacity = 1) =>
  `<svg viewBox="0 0 64 64" width="${size}" height="${size}" style="opacity:${opacity}">
     <path d="${TOP}" fill="${fill}"/><path d="${BOTTOM}" fill="${fill}"/>
   </svg>`

const TAGLINE = 'Every song. Any language. Same soul.'
const DESCRIPTOR = 'Authorized versions of finished records, in the artist&rsquo;s own voice'

const serif = (size, color) =>
  `font-family:'Fraunces Kit',Georgia,serif;font-weight:600;font-size:${size}px;letter-spacing:-0.6px;color:${color};line-height:1.1;`
const sans = (size, color) =>
  `font-family:'Archivo Kit',system-ui,sans-serif;font-size:${size}px;letter-spacing:2.2px;text-transform:uppercase;color:${color};`

/* 1. Quiet. Cream ground, type only. What the site itself would do. */
const quiet = `
  <div style="width:100%;height:100%;background:${C.cream};display:flex;align-items:center;justify-content:flex-end;padding:0 72px;">
    <div style="text-align:right;">
      <div style="${serif(34, C.graphite)}">${TAGLINE}</div>
      <div style="${sans(12, 'rgba(28,26,25,0.55)')};margin-top:13px;">${DESCRIPTOR}</div>
    </div>
  </div>`

/* 2. Listening. The dark treatment the site reserves for listening surfaces. Indigo is
   never used on this ground (2.7:1), so the only accent available is dark accent, and it
   carries a rule rather than the sentence. */
const listening = `
  <div style="width:100%;height:100%;background:${C.darkGround};display:flex;align-items:center;justify-content:flex-end;padding:0 72px;">
    <div style="text-align:right;">
      <div style="width:64px;height:2px;background:${C.darkAccent};margin-left:auto;margin-bottom:18px;"></div>
      <div style="${serif(34, C.darkInk)}">${TAGLINE}</div>
      <div style="${sans(12, 'rgba(237,235,228,0.5)')};margin-top:13px;">${DESCRIPTOR}</div>
    </div>
  </div>`

/* 3. Identity. Indigo field, cream type, the mark repeated as rhythm rather than as a
   second logo. Opacity, not a gradient: the ground stays one flat colour. */
const identity = `
  <div style="width:100%;height:100%;background:${C.indigo};display:flex;align-items:center;justify-content:space-between;padding:0 72px;position:relative;overflow:hidden;">
    <div style="display:flex;align-items:center;gap:26px;padding-left:188px;">
      ${mark(C.cream, 44, 0.13)}${mark(C.cream, 44, 0.2)}${mark(C.cream, 44, 0.3)}
    </div>
    <div style="text-align:right;">
      <div style="${serif(34, C.cream)}">${TAGLINE}</div>
      <div style="${sans(12, 'rgba(247,239,225,0.6)')};margin-top:13px;">${DESCRIPTOR}</div>
    </div>
  </div>`

const browser = await chromium.launch()
const page = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage()
await page.setViewportSize({ width: W, height: H })

for (const [name, body] of [
  ['cover-1-quiet', quiet],
  ['cover-2-listening', listening],
  ['cover-3-identity', identity],
]) {
  await page.setContent(
    `<style>${FONTS}*{margin:0;padding:0;box-sizing:border-box}body{width:${W}px;height:${H}px;overflow:hidden}</style>${body}`,
    { waitUntil: 'load' },
  )
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: W, height: H } })
  console.log(`  ${OUT}/${name}.png`)
}

await browser.close()
