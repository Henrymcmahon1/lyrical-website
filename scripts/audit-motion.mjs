/**
 * Motion audit. The companion to audit-responsive.mjs: that one proves nothing is BLANK,
 * this one proves the motion actually MOVES.
 *
 * Playwright rather than a browser-pane session, because every driver here is a
 * requestAnimationFrame loop and rAF is throttled or paused outright in a hidden pane. A
 * measurement taken there reads as "nothing animated" whether or not anything is wrong.
 *
 * Covers, at 375x812 unless stated:
 *   - the pause-to-mark morph: both phases, on screen, and reversible
 *   - the turn line arriving
 *   - per-item reveals, and that none is left stranded after a full walk of the page
 *   - the sticky rails surviving their ancestor chain
 *   - reduced motion and JavaScript-disabled leaving nothing invisible
 *   - 1280x800: desktop geometry byte-for-byte unchanged
 *
 *   node scripts/audit-motion.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { auditMobilePin } from './mobile-pin-block.mjs'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch()

const fails = []
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) fails.push(name)
}

async function sample(page, selector, offsets, read) {
  return page.evaluate(
    async ({ selector, offsets, readSrc }) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms))
      const settle = async (cap = 1500) => {
        const t0 = Date.now()
        let last = NaN
        let same = 0
        while (Date.now() - t0 < cap) {
          await new Promise((r) => {
            const id = setTimeout(r, 50)
            requestAnimationFrame(() => {
              clearTimeout(id)
              r()
            })
          })
          const y = Math.round(window.scrollY)
          if (y === last) {
            if (++same >= 2) return true
          } else {
            same = 0
            last = y
          }
        }
        return false
      }

      const read = new Function('el', `return (${readSrc})(el)`)
      const el = document.querySelector(selector)
      const base = window.scrollY + el.getBoundingClientRect().top
      const out = []
      for (const off of offsets) {
        window.scrollTo(0, Math.max(0, base + off))
        await settle()
        await wait(500)
        out.push({ off, ...read(el) })
      }
      return out
    },
    { selector, offsets, readSrc: read },
  )
}

/** Reads from the animated <svg> itself, which is also the mobile driver's anchor. */
const READ_MORPH = `(svg) => {
  const g = svg.querySelector('g');
  const rot = /rotate\\(([-\\d.]+)/.exec(g.getAttribute('transform') || '');
  const d = svg.querySelector('path').getAttribute('d') || '';
  const r = svg.getBoundingClientRect();
  return {
    rotate: rot ? Math.round(parseFloat(rot[1])) : null,
    markTop: Math.round(r.top),
    onScreen: r.top < window.innerHeight && r.bottom > 0,
    dHash: d.length,
    dHead: d.slice(0, 24),
    after: svg.closest('.audience-track').dataset.after,
  };
}`

const READ_MORPH_DESKTOP = `(el) => (${READ_MORPH})(el.querySelector('svg.a-anim'))`

// ── Mobile: the pinned contract ─────────────────────────────────
await auditMobilePin({ browser, base: BASE, check })

// ── Mobile, reduced motion ───────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  console.log('\n── 375x812, prefers-reduced-motion: reduce ──')

  const faded = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('.pin-reveal, .turn-line, .a-bloom, .reveal')) {
      if (+getComputedStyle(el).opacity < 0.08) {
        out.push({ cls: el.className.slice(0, 40), text: el.textContent.trim().slice(0, 40) })
      }
    }
    return out
  })
  check('nothing is stranded invisible under reduced motion', faded.length === 0, JSON.stringify(faded.slice(0, 5)))
  await ctx.close()
}

// ── Mobile, JavaScript disabled ──────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    javaScriptEnabled: false,
  })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  console.log('\n── 375x812, JavaScript disabled ──')
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  check('page still renders its copy with JS off', text.length > 2000, `${text.length} chars`)
  check('the audience section shows its resolved state', text.includes('Everyone who was always going to love it'))
  check('the steps are all readable', text.includes('It starts with permission') && text.includes('You get the assets'))
  await ctx.close()
}

// ── Desktop regression ───────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  console.log('\n── 1280x800, desktop must be unchanged ──')

  const geo = await page.evaluate(() => {
    const g = (sel) => {
      const el = document.querySelector(sel)
      return el ? Math.round(el.getBoundingClientRect().height / window.innerHeight * 100) / 100 : null
    }
    return {
      audienceVh: g('.audience-track'),
      turnVh: g('.turn-track'),
      pinVh: [...document.querySelectorAll('.pin-track')].map(
        (el) => Math.round(el.getBoundingClientRect().height / window.innerHeight * 100) / 100),
      audiencePadding: getComputedStyle(document.querySelector('.audience-track')).paddingTop,
      panelPosition: getComputedStyle(document.querySelector('.pin-panel')).position,
      railsVisible: [...document.querySelectorAll('.pin-panel > .sticky')].filter(
        (b) => getComputedStyle(b).display !== 'none').length,
    }
  })
  console.log(JSON.stringify(geo))
  check('audience track is still 1.9 viewports', geo.audienceVh === 1.9, `${geo.audienceVh}`)
  check('turn track is still 1.5 viewports', geo.turnVh === 1.5, `${geo.turnVh}`)
  check('audience padding is still 0 on desktop', geo.audiencePadding === '0px', geo.audiencePadding)
  check('panels still pin', geo.panelPosition === 'sticky', geo.panelPosition)
  check('the mobile rail is hidden on desktop', geo.railsVisible === 0, `${geo.railsVisible} visible`)
  check('pin tracks unchanged: 100vh + 26vh per step',
    JSON.stringify(geo.pinVh) === JSON.stringify([2.04, 2.3, 2.04]), JSON.stringify(geo.pinVh))

  const desktopMorph = await sample(page, '.audience-track', [0, 250, 500, 750], READ_MORPH_DESKTOP)
  const dRots = desktopMorph.map((s) => s.rotate)
  check('desktop morph still runs off the pinned track', new Set(dRots).size >= 3, `rotate: ${dRots.join(' -> ')}`)
  await ctx.close()
}

await browser.close()
console.log(`\n${'='.repeat(60)}`)
if (fails.length) {
  console.log(`${fails.length} FAILED:\n${fails.map((f) => `  - ${f}`).join('\n')}`)
  process.exitCode = 1
} else {
  console.log('ALL PASS')
}
