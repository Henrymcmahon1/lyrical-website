/**
 * Build the shareable brand kit.
 *
 * Every logo is generated from `lib/mark.ts`, the same Bezier geometry the website renders,
 * so an exported file can never drift from the live mark. Rasters are produced by loading the
 * generated SVG in a real browser with the real self-hosted fonts, so the lockup's type is
 * accurate rather than approximated.
 *
 *   node scripts/build-brand-kit.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs'
import { writeDocs } from './brand-kit-docs.mjs'
import { toPath } from '../lib/mark.ts'
import { APPROX } from '../lib/mark-states.ts'

const OUT = 'brand-kit'
const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

const C = {
  cream: '#F7EFE1',
  graphite: '#1C1A19',
  indigo: '#4433D6',
  ember: '#EE4E22',
  darkGround: '#1B1D1F',
  darkInk: '#EDEBE4',
  darkAccent: '#FF6B2C',
  white: '#FFFFFF',
}

for (const d of ['logo/svg', 'logo/png', 'social', 'colour', 'fonts', 'templates']) {
  mkdirSync(`${OUT}/${d}`, { recursive: true })
}

// ── 1. Mark SVGs: pure paths, no font dependency, safe anywhere ───────────────
const markSvg = (fill, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Lyrical">
${bg ? `  <rect width="64" height="64" fill="${bg}"/>\n` : ''}  <path d="${TOP}" fill="${fill}"/>
  <path d="${BOTTOM}" fill="${fill}"/>
</svg>
`

const MARKS = [
  ['lyrical-mark-indigo', C.indigo, null],
  ['lyrical-mark-graphite', C.graphite, null],
  ['lyrical-mark-cream', C.cream, null],
  ['lyrical-mark-white', C.white, null],
  ['lyrical-mark-indigo-on-cream', C.indigo, C.cream],
  ['lyrical-mark-cream-on-indigo', C.cream, C.indigo],
  ['lyrical-mark-accent-on-dark', C.darkAccent, C.darkGround],
]
for (const [name, fill, bg] of MARKS) {
  writeFileSync(`${OUT}/logo/svg/${name}.svg`, markSvg(fill, bg))
}

// ── 2. Lockup SVGs: font embedded as a data URI so the web renders it correctly ──
const fraunces = readFileSync('public/fonts/Fraunces.woff2').toString('base64')
const FONT_FACE = `@font-face{font-family:'Fraunces Kit';src:url(data:font/woff2;base64,${fraunces}) format('woff2');font-weight:100 900;}`

const lockupSvg = ({ w, h, markX, markY, markSize, textX, textY, fontSize, fill, bg }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Lyrical">
  <style>${FONT_FACE}</style>
${bg ? `  <rect width="${w}" height="${h}" fill="${bg}"/>\n` : ''}  <g transform="translate(${markX} ${markY}) scale(${markSize / 64})">
    <path d="${TOP}" fill="${C.indigo}"/>
    <path d="${BOTTOM}" fill="${C.indigo}"/>
  </g>
  <text x="${textX}" y="${textY}" fill="${fill}" font-family="'Fraunces Kit',Georgia,serif" font-weight="600" font-size="${fontSize}" letter-spacing="-0.5">lyrical</text>
</svg>
`

writeFileSync(
  `${OUT}/logo/svg/lyrical-lockup-horizontal.svg`,
  lockupSvg({ w: 260, h: 64, markX: 0, markY: 12, markSize: 40, textX: 52, textY: 46, fontSize: 42, fill: C.graphite, bg: null }),
)
writeFileSync(
  `${OUT}/logo/svg/lyrical-lockup-horizontal-on-cream.svg`,
  lockupSvg({ w: 300, h: 96, markX: 20, markY: 28, markSize: 40, textX: 72, textY: 62, fontSize: 42, fill: C.graphite, bg: C.cream }),
)
writeFileSync(
  `${OUT}/logo/svg/lyrical-lockup-stacked.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160" width="220" height="160" role="img" aria-label="Lyrical">
  <style>${FONT_FACE}</style>
  <g transform="translate(78 18) scale(1)">
    <path d="${TOP}" fill="${C.indigo}"/>
    <path d="${BOTTOM}" fill="${C.indigo}"/>
  </g>
  <text x="110" y="132" fill="${C.graphite}" text-anchor="middle" font-family="'Fraunces Kit',Georgia,serif" font-weight="600" font-size="44" letter-spacing="-0.5">lyrical</text>
</svg>
`,
)

// ── 3. Colour reference ──────────────────────────────────────────────────────
const hexToRgb = (h) => {
  const n = parseInt(h.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}
const PALETTE = [
  ['Cream', C.cream, 'Space. The default page ground.'],
  ['Graphite', C.graphite, 'Type. All body copy and headings.'],
  ['Indigo', C.indigo, 'Identity. The mark, links, focus rings.'],
  ['Ember', C.ember, 'Action. Primary buttons and fills ONLY, never body text.'],
  ['Dark ground', C.darkGround, 'Listening sections only.'],
  ['Dark ink', C.darkInk, 'Type on the dark ground.'],
  ['Dark accent', C.darkAccent, 'Action on the dark ground. Replaces ember there.'],
]
writeFileSync(
  `${OUT}/colour/palette.txt`,
  [
    'LYRICAL COLOUR PALETTE',
    '======================',
    '',
    ...PALETTE.flatMap(([n, hex, use]) => [
      `${n}`,
      `  HEX  ${hex}`,
      `  RGB  ${hexToRgb(hex)}`,
      `  Use  ${use}`,
      '',
    ]),
    'RULES',
    '  Four colours, four jobs. Do not add a fifth.',
    '  No gradients, anywhere, on anything.',
    `  Ember is 3.2:1 on cream. It FAILS as body text. Fills and large type only.`,
    '  Indigo is 2.7:1 on the dark ground. Never use it there.',
    '',
  ].join('\n'),
)

// ── 4. Rasters, rendered in a real browser ───────────────────────────────────
const browser = await chromium.launch()
const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage()

const archivo = readFileSync('public/fonts/Archivo.woff2').toString('base64')
const FONTS = `
  @font-face{font-family:'Fraunces Kit';src:url(data:font/woff2;base64,${fraunces}) format('woff2');font-weight:100 900;}
  @font-face{font-family:'Archivo Kit';src:url(data:font/woff2;base64,${archivo}) format('woff2');font-weight:100 900;}
`

const MARK_INLINE = (fill, size) =>
  `<svg viewBox="0 0 64 64" width="${size}" height="${size}"><path d="${TOP}" fill="${fill}"/><path d="${BOTTOM}" fill="${fill}"/></svg>`

async function shot(path, w, h, body) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(
    `<style>${FONTS}*{margin:0;padding:0;box-sizing:border-box}body{width:${w}px;height:${h}px;overflow:hidden}</style>${body}`,
    { waitUntil: 'load' },
  )
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path, clip: { x: 0, y: 0, width: w, height: h } })
  console.log(`  ${path}  ${w}x${h}`)
}

const centre = (bg, inner) =>
  `<div style="width:100%;height:100%;background:${bg};display:flex;align-items:center;justify-content:center;">${inner}</div>`

console.log('rasters:')

// Plain mark PNGs, transparent
for (const size of [1024, 512, 192]) {
  await shot(
    `${OUT}/logo/png/lyrical-mark-indigo-${size}.png`,
    size,
    size,
    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${MARK_INLINE(C.indigo, size * 0.78)}</div>`,
  )
}

// Social avatars. Square, mark centred, generous margin because both platforms crop to a circle.
await shot(
  `${OUT}/social/instagram-profile-1080.png`,
  1080, 1080,
  centre(C.cream, MARK_INLINE(C.indigo, 560)),
)
await shot(
  `${OUT}/social/linkedin-logo-400.png`,
  400, 400,
  centre(C.cream, MARK_INLINE(C.indigo, 210)),
)
await shot(
  `${OUT}/social/avatar-indigo-ground-1080.png`,
  1080, 1080,
  centre(C.indigo, MARK_INLINE(C.cream, 560)),
)

// LinkedIn company banner, 1128x191. Safe area is generous because the logo tile overlaps
// the lower left on desktop, so everything sits right of centre.
await shot(
  `${OUT}/social/linkedin-banner-1128x191.png`,
  1128, 191,
  `<div style="width:100%;height:100%;background:${C.cream};display:flex;align-items:center;justify-content:flex-end;padding-right:72px;">
     <div style="font-family:'Fraunces Kit',Georgia,serif;font-weight:600;font-size:34px;color:${C.graphite};letter-spacing:-0.5px;text-align:right;line-height:1.15;">
       Every song. Any language.<br/>Same soul.
     </div>
   </div>`,
)

// Instagram post template, 1080 square.
await shot(
  `${OUT}/social/instagram-post-1080.png`,
  1080, 1080,
  `<div style="width:100%;height:100%;background:${C.cream};display:flex;flex-direction:column;justify-content:space-between;padding:96px;">
     <div>${MARK_INLINE(C.indigo, 132)}</div>
     <div style="font-family:'Fraunces Kit',Georgia,serif;font-weight:600;font-size:82px;line-height:1.06;color:${C.graphite};letter-spacing:-1.5px;">
       Every song.<br/>Any language.<br/>Same soul.
     </div>
     <div style="font-family:'Archivo Kit',system-ui,sans-serif;font-size:26px;color:${C.graphite};opacity:.6;letter-spacing:2px;text-transform:uppercase;">
       lyrical
     </div>
   </div>`,
)

// Open Graph / link preview, 1200x630.
await shot(
  `${OUT}/social/og-image-1200x630.png`,
  1200, 630,
  `<div style="width:100%;height:100%;background:${C.cream};display:flex;flex-direction:column;justify-content:center;padding:0 92px;gap:36px;">
     <div>${MARK_INLINE(C.indigo, 96)}</div>
     <div style="font-family:'Fraunces Kit',Georgia,serif;font-weight:600;font-size:66px;line-height:1.08;color:${C.graphite};letter-spacing:-1.2px;">
       Every song. Any language.<br/>Same soul.
     </div>
     <div style="font-family:'Archivo Kit',system-ui,sans-serif;font-size:24px;line-height:1.5;color:${C.graphite};opacity:.7;max-width:820px;">
       Authorised versions of finished records, in the artist&rsquo;s own voice.
     </div>
   </div>`,
)

// Colour swatch sheet.
await shot(
  `${OUT}/colour/swatches.png`,
  1200, 520,
  `<div style="width:100%;height:100%;background:#fff;display:flex;flex-direction:column;font-family:'Archivo Kit',system-ui,sans-serif;">
     <div style="display:flex;flex:1;">
       ${PALETTE.map(([n, hex]) => `
         <div style="flex:1;background:${hex};display:flex;align-items:flex-end;padding:20px;">
           <div style="font-size:15px;color:${['Cream', 'Dark ink'].includes(n) ? C.graphite : '#fff'};">
             <div style="font-weight:600;">${n}</div>
             <div style="opacity:.85;font-variant-numeric:tabular-nums;">${hex}</div>
           </div>
         </div>`).join('')}
     </div>
     <div style="padding:22px 24px;font-size:15px;color:${C.graphite};border-top:1px solid #e5e0d5;">
       Four colours, four jobs. No gradients. Ember never carries body text. Indigo never on the dark ground.
     </div>
   </div>`,
)

// Type specimen.
await shot(
  `${OUT}/colour/type-specimen.png`,
  1200, 720,
  `<div style="width:100%;height:100%;background:${C.cream};padding:72px;color:${C.graphite};">
     <div style="font-family:'Archivo Kit';font-size:13px;letter-spacing:2.5px;text-transform:uppercase;opacity:.5;">Brand voice / Fraunces</div>
     <div style="font-family:'Fraunces Kit',Georgia,serif;font-weight:600;font-size:76px;line-height:1.05;letter-spacing:-1.5px;margin-top:14px;">
       Every song. Any language.
     </div>
     <div style="font-family:'Fraunces Kit',Georgia,serif;font-weight:600;font-size:38px;margin-top:18px;opacity:.75;">
       ABCDEFGHIJKLM abcdefghijklm 0123456789
     </div>
     <div style="font-family:'Archivo Kit';font-size:13px;letter-spacing:2.5px;text-transform:uppercase;opacity:.5;margin-top:56px;">Product voice / Archivo</div>
     <div style="font-family:'Archivo Kit',system-ui,sans-serif;font-size:23px;line-height:1.6;margin-top:14px;max-width:900px;">
       We recreate a finished record in another language so it sounds like the artist genuinely
       recorded it that way. The melody, the rhythm and the feel are kept intact.
     </div>
     <div style="font-family:'Archivo Kit',system-ui,sans-serif;font-size:19px;margin-top:16px;opacity:.7;">
       ABCDEFGHIJKLM abcdefghijklm 0123456789
     </div>
   </div>`,
)

await browser.close()

// ── 5. Fonts ─────────────────────────────────────────────────────────────────
copyFileSync('public/fonts/Fraunces.woff2', `${OUT}/fonts/Fraunces.woff2`)
copyFileSync('public/fonts/Archivo.woff2', `${OUT}/fonts/Archivo.woff2`)
writeFileSync(
  `${OUT}/fonts/README.txt`,
  [
    'FONTS',
    '=====',
    '',
    'Fraunces  brand voice. Headlines, the wordmark, any display type.',
    '          Chosen for its optical-size axis: it is drawn differently at 16px and 72px.',
    'Archivo   product voice. Body copy, UI, labels, captions.',
    '',
    'Both are licensed under the SIL Open Font License, so they can be used commercially,',
    'embedded in documents and self-hosted. Get the full family, including the licence file,',
    'from Google Fonts:',
    '  https://fonts.google.com/specimen/Fraunces',
    '  https://fonts.google.com/specimen/Archivo',
    '',
    'The .woff2 files here are web subsets used by the site. For Word, Keynote, Figma or print,',
    'install the .ttf from Google Fonts instead.',
    '',
    'NEVER load these from a CDN on the website. They are self-hosted deliberately.',
    '',
  ].join('\n'),
)

console.log('\nbrand kit written to ./brand-kit')

// ── 6. The written half: guide, social copy, checklist, templates ─────────
writeDocs({ OUT, TOP, BOTTOM, fraunces, archivo })
