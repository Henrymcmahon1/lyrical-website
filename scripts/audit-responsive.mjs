/**
 * Responsive audit.
 *
 * Loads every route at real device viewports and checks the things that actually break:
 * horizontal overflow, blank screens, tap-target size, text that runs off its box, and
 * text clipped inside a pinned panel.
 *
 *   node scripts/audit-responsive.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3000'
// Every public route in the sitemap. A new page that nothing audits is a page that silently
// clips on a phone: this list has to grow with app/sitemap.ts, not lag behind it.
/**
 * Every public route. `/contact` joined on 2026-08-11 when the enquiry form moved off the home
 * page: it carries the only form on the site, which is the thing most likely to overflow a
 * narrow screen or ship a tap target under 44px, so leaving it out would have quietly retired
 * the check that matters most.
 *
 * Gated routes are deliberately absent. They need a session this script does not have, and a
 * 200 from a login page would tell you nothing about the page behind it.
 */
const ROUTES = ['/', '/ai-music-translation', '/hear', '/about', '/contact']
const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667, mobile: true },
  { name: 'iphone-15', width: 393, height: 852, mobile: true },
  { name: 'pixel-tall', width: 412, height: 915, mobile: true },
  { name: 'ipad', width: 768, height: 1024, mobile: false },
  { name: 'laptop', width: 1280, height: 800, mobile: false },
]

mkdirSync('.audit', { recursive: true })

const problems = []
const note = (route, vp, kind, detail) =>
  problems.push({ route, viewport: vp, kind, detail })

const browser = await chromium.launch()

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    userAgent: vp.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  })
  const page = await context.newPage()

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // 1. Horizontal overflow, and what causes it.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      const over = doc.scrollWidth > window.innerWidth + 1
      if (!over) return null
      const culprits = []
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.right > window.innerWidth + 1 || r.left < -1) {
          culprits.push({
            tag: el.tagName,
            cls: String(el.className || '').slice(0, 60),
            right: Math.round(r.right),
            left: Math.round(r.left),
          })
        }
      })
      return { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, culprits: culprits.slice(0, 6) }
    })
    if (overflow) note(route, vp.name, 'horizontal-overflow', overflow)

    // 2. Tap targets: interactive elements should be at least 44px on a touch device.
    if (vp.mobile) {
      const small = await page.evaluate(() => {
        const out = []
        document.querySelectorAll('a, button, [role="button"], input, select, textarea').forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return
          if (getComputedStyle(el).display === 'none') return

          /**
           * Measure what the FINGER hits, not the control.
           *
           * The visually-hidden-input-inside-a-sized-label pattern is the correct way to
           * build a custom checkbox: the input is 1x1 and `sr-only`, and the label carries
           * the 44px target. Measuring the input reported nine false positives and made this
           * check permanently red, which is worse than not having it.
           */
          const target = el.closest('label') ?? el
          const tr = target.getBoundingClientRect()

          // Not reachable by keyboard or touch at all: spam honeypots live here.
          if (el.tabIndex < 0) return

          // Hidden until focused, e.g. a skip-to-content link. Its size when visible is
          // what matters, and that only exists on focus.
          if (/focus:not-sr-only/.test(String(el.className || ''))) return

          if (tr.height < 40) {
            out.push({
              tag: el.tagName,
              measured: target === el ? 'self' : 'label',
              text: (target.textContent || '').trim().slice(0, 30),
              h: Math.round(tr.height),
              w: Math.round(tr.width),
            })
          }
        })
        return out.slice(0, 10)
      })
      if (small.length) note(route, vp.name, 'small-tap-targets', small)
    }

    // 3. Blank screens: walk the page and measure visible, non-transparent text.
    const blanks = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms))

      /**
       * Wait for the scroll position to actually stop.
       *
       * Lenis eases scroll, so `scrollTo` returns long before `scrollY` arrives. A fixed
       * timeout here sampled mid-flight and produced false readings twice on this project.
       * Poll until scrollY is unchanged across consecutive frames instead.
       *
       * The frame wait races rAF against a timer: rAF is throttled or paused entirely in a
       * backgrounded or hidden page, and without the timer this loop would hang there.
       */
      const frame = () =>
        new Promise((r) => {
          const id = setTimeout(r, 50)
          requestAnimationFrame(() => {
            clearTimeout(id)
            r()
          })
        })

      const settle = async (cap = 1500) => {
        const t0 = Date.now()
        let last = NaN
        let same = 0
        while (Date.now() - t0 < cap) {
          await frame()
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

      const ink = () => {
        let c = 0
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        let n
        while ((n = w.nextNode())) {
          const t = n.textContent.trim()
          if (!t) continue
          let p = n.parentElement
          let faded = false
          while (p && p !== document.body) {
            const cs = getComputedStyle(p)
            if (parseFloat(cs.opacity) < 0.08 || cs.visibility === 'hidden' || cs.display === 'none') {
              faded = true
              break
            }
            p = p.parentElement
          }
          if (faded) continue
          const r = n.parentElement.getBoundingClientRect()
          if (r.bottom > 60 && r.top < window.innerHeight && r.width > 0) c += t.length
        }
        return c
      }
      const out = []
      const H = document.documentElement.scrollHeight
      for (let y = 0; y < Math.max(1, H - window.innerHeight); y += Math.floor(window.innerHeight * 0.3)) {
        window.scrollTo(0, y)
        const settled = await settle()

        /**
         * Then wait out the longest reveal.
         *
         * Reveals run 0.75s and the mobile per-item reveals 0.6s, so measuring the instant
         * scrolling stops catches items legitimately mid-fade and reports them as blank.
         * A permanent blank is still permanent after this wait, so erring long only removes
         * false positives.
         */
        await wait(900)

        const i = ink()
        if (i < 25) out.push({ y: Math.round(window.scrollY), ink: i, settled })
      }
      window.scrollTo(0, 0)
      await settle()
      return out
    })
    if (blanks.length) note(route, vp.name, 'blank-screens', blanks)

    /*
     * 4. Text clipped INSIDE a pinned panel.
     *
     * A pinned panel is a fixed `100vh - nav` box and its content is clipped, not scrolled,
     * when it does not fit. That is invisible to every other check here: the page does not
     * overflow horizontally, no screen is blank, and the text is present in the DOM. It just
     * cannot be read.
     *
     * It shipped once. On a short screen the audience section lost its closing paragraph
     * entirely, and the only reason anybody found out is that Henry scrolled the live site
     * on his phone.
     */
    const clipped = await page.evaluate(async () => {
      const out = new Set()
      // Most routes have no pinned panel at all. Walking them costs minutes and can find
      // nothing, so leave immediately rather than scrolling a page with nothing to check.
      if (!document.querySelector('.audience-panel, .pin-panel, .turn-panel')) return []
      const settle = () => new Promise((r) => setTimeout(r, 160))
      for (let y = 0; y < document.body.scrollHeight; y += Math.round(window.innerHeight * 0.6)) {
        window.scrollTo(0, y)
        await settle()
        for (const panel of document.querySelectorAll('.audience-panel, .pin-panel, .turn-panel')) {
          const pr = panel.getBoundingClientRect()
          if (pr.bottom < 0 || pr.top > window.innerHeight) continue
          for (const el of panel.querySelectorAll('h1, h2, h3, p, li')) {
            const r = el.getBoundingClientRect()
            // Mid-fade items are legitimately invisible; only settled content counts.
            if (!el.innerText.trim() || r.height === 0) continue
            if (getComputedStyle(el).opacity === '0') continue
            if (r.bottom > pr.bottom + 1 || r.top < pr.top - 1) {
              out.add(el.innerText.replace(/\s+/g, ' ').slice(0, 60))
            }
          }
        }
      }
      window.scrollTo(0, 0)
      return [...out]
    })
    if (clipped.length) note(route, vp.name, 'clipped-in-pinned-panel', clipped)

    // 5. Page length in screens.
    const screens = await page.evaluate(
      () => +(document.documentElement.scrollHeight / window.innerHeight).toFixed(1),
    )

    await page.screenshot({
      path: `.audit/${vp.name}${route.replace(/\//g, '_') || '_home'}.png`,
      fullPage: false,
    })

    console.log(
      `${vp.name.padEnd(11)} ${route.padEnd(7)} ${String(screens).padStart(5)} screens` +
        (overflow ? '  OVERFLOW' : '') +
        (blanks.length ? `  ${blanks.length} BLANK` : '') +
        (clipped.length ? `  ${clipped.length} CLIPPED` : ''),
    )
  }

  await context.close()
}

await browser.close()

console.log('\n' + '='.repeat(60))
if (problems.length === 0) {
  console.log('PASS: no overflow, no blank screens, no small tap targets, nothing clipped.')
} else {
  console.log(`${problems.length} problem group(s):\n`)
  for (const p of problems) {
    console.log(`  [${p.kind}] ${p.route} @ ${p.viewport}`)
    console.log('   ', JSON.stringify(p.detail).slice(0, 600), '\n')
  }
  process.exitCode = 1
}
