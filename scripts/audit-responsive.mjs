/**
 * Responsive audit.
 *
 * Loads every route at real device viewports and checks the things that actually break:
 * horizontal overflow, blank screens, tap-target size, and text that runs off its box.
 *
 *   node scripts/audit-responsive.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const ROUTES = ['/', '/hear', '/about']
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
          if (r.height < 40) {
            out.push({
              tag: el.tagName,
              text: (el.textContent || '').trim().slice(0, 30),
              h: Math.round(r.height),
              w: Math.round(r.width),
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
        await wait(260)
        const i = ink()
        if (i < 25) out.push({ y: Math.round(window.scrollY), ink: i })
      }
      window.scrollTo(0, 0)
      return out
    })
    if (blanks.length) note(route, vp.name, 'blank-screens', blanks)

    // 4. Page length in screens.
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
        (blanks.length ? `  ${blanks.length} BLANK` : ''),
    )
  }

  await context.close()
}

await browser.close()

console.log('\n' + '='.repeat(60))
if (problems.length === 0) {
  console.log('PASS: no overflow, no blank screens, no small tap targets.')
} else {
  console.log(`${problems.length} problem group(s):\n`)
  for (const p of problems) {
    console.log(`  [${p.kind}] ${p.route} @ ${p.viewport}`)
    console.log('   ', JSON.stringify(p.detail).slice(0, 600), '\n')
  }
  process.exitCode = 1
}
