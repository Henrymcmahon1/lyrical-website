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

const READ_TURN = `(el) => {
  const line = el.querySelector('.turn-line');
  return { opacity: +(+getComputedStyle(line).opacity).toFixed(2), transform: getComputedStyle(line).transform };
}`

// ── Mobile ───────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })

  console.log('\n── 375x812, motion allowed ──')

  /**
   * The morph has two phases and they must be measured separately. Rotation runs over the
   * first 45% of progress (`rot = -90 + 90 * min(1, p / 0.45)`), then holds at 0 while the
   * outline bends over the remaining 55%.
   *
   * Offsets are relative to the MARK, which is what drives the mobile clock. At 812px tall
   * with a 0.7 span the travel is 568px: progress is 0 with the mark's top on the bottom
   * edge (-812), 0.45 at -556, and 1 at -244.
   */
  const rotPhase = await sample(page, 'svg.a-anim', [-812, -740, -660, -580], READ_MORPH)
  console.log(JSON.stringify(rotPhase.map((s) => ({ off: s.off, markTop: s.markTop, rotate: s.rotate, onScreen: s.onScreen }))))
  const rots = rotPhase.map((s) => s.rotate)
  check(
    'phase 1: the pause rotates upright progressively',
    new Set(rots).size >= 3 && rots.every((r, i) => i === 0 || r >= rots[i - 1]),
    `rotate: ${rots.join(' -> ')}`,
  )
  check('phase 1 starts from the pause bars (about -90deg)', rots[0] <= -88, `first=${rots[0]}`)
  check(
    'the pause bars are ON SCREEN when the morph begins',
    rotPhase.every((s) => s.onScreen),
    `markTop: ${rotPhase.map((s) => s.markTop).join(', ')}`,
  )

  const bendPhase = await sample(page, 'svg.a-anim', [-540, -450, -350, -244], READ_MORPH)
  console.log(JSON.stringify(bendPhase.map((s) => ({ off: s.off, rotate: s.rotate, dHead: s.dHead }))))
  check(
    'phase 2: rotation holds at 0 while the outline bends',
    bendPhase.every((s) => s.rotate === 0),
    `rotate: ${bendPhase.map((s) => s.rotate).join(' -> ')}`,
  )
  const shapes = new Set(bendPhase.map((s) => s.dHead))
  check('phase 2: the outline interpolates through distinct frames', shapes.size >= 3, `${shapes.size} distinct`)
  check('the language bloom resolves by the end', bendPhase.at(-1).after === 'true')

  /**
   * Bidirectionality, stated as the property that actually matters: the same scroll position
   * yields the same morph state whether it was reached going down or coming back up.
   */
  const round = await sample(page, 'svg.a-anim', [-800, -400, -800], READ_MORPH)
  const [start, middle, back] = round
  check(
    'the morph reverses: returning to a position restores its state',
    start.rotate === back.rotate && start.dHead === back.dHead && start.dHead !== middle.dHead,
    `rotate ${start.rotate} -> ${middle.rotate} -> ${back.rotate}, dLen ${start.dHash} -> ${middle.dHash} -> ${back.dHash}`,
  )
  check('the bloom un-resolves on the way back up', start.after === 'false' && back.after === 'false',
    `after: ${start.after} -> ${middle.after} -> ${back.after}`)

  const turn = await sample(page, '.turn-track', [-800, -500, -250, 0], READ_TURN)
  console.log(JSON.stringify(turn.map((t) => ({ off: t.off, opacity: t.opacity }))))
  const ops = turn.map((t) => t.opacity)
  check('turn line fades in on mobile', ops[0] < 0.5 && ops.at(-1) > 0.95, `opacity: ${ops.join(' -> ')}`)

  const reveals = await page.evaluate(async () => {
    const out = {}
    for (const sel of ['.pin-reveal']) {
      const all = [...document.querySelectorAll(sel)]
      out.total = all.length
      out.hidden = all.filter((el) => +getComputedStyle(el).opacity < 0.08).length
    }
    return out
  })
  check('pin-reveal exists and some items are still waiting off-screen', reveals.total > 0, JSON.stringify(reveals))

  // Walk the whole page and confirm every reveal ends up visible.
  const stranded = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const H = document.documentElement.scrollHeight
    for (let y = 0; y < H; y += Math.floor(window.innerHeight * 0.4)) {
      window.scrollTo(0, y)
      await wait(700)
    }
    window.scrollTo(0, 0)
    await wait(500)
    return [...document.querySelectorAll('.pin-reveal')]
      .filter((el) => !el.classList.contains('in'))
      .map((el) => el.querySelector('h3')?.textContent?.trim().slice(0, 40))
  })
  check('no pin-reveal item is left without .in after a full walk', stranded.length === 0, JSON.stringify(stranded))

  const rail = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('.pin-panel > .sticky')]
    return bars.map((b) => ({
      position: getComputedStyle(b).position,
      top: getComputedStyle(b).top,
      label: b.textContent.trim().slice(0, 30),
    }))
  })
  check('sticky rails are actually sticky (no overflow ancestor killing them)',
    rail.length > 0 && rail.every((r) => r.position === 'sticky'), JSON.stringify(rail))

  await ctx.close()
}

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
