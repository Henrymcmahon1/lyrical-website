/**
 * The mobile half of the motion audit: the pinned-section contract.
 *
 * Since 2026-07-31 every section pins on a phone as well as on desktop. The properties that
 * matter are different from the unpinned era, so they are asserted directly:
 *
 *   - the panel actually HOLDS STILL while the page scrolls, which is the whole point
 *   - it holds below the sticky nav rather than underneath it
 *   - the active item advances, and the progress line advances with it
 *   - nothing is clipped out of the panel
 *   - the morph and the copy both resolve while the reader is held, not after
 *
 * Exported as a function so audit-motion.mjs stays one entry point.
 */
export async function auditMobilePin({ browser, base, check }) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()
  await page.goto(base, { waitUntil: 'networkidle' })

  const settleTo = (y) =>
    page.evaluate(async (y) => {
      window.scrollTo(0, y)
      let last = NaN
      let same = 0
      const t0 = Date.now()
      while (Date.now() - t0 < 1500) {
        await new Promise((r) => {
          const i = setTimeout(r, 50)
          requestAnimationFrame(() => {
            clearTimeout(i)
            r()
          })
        })
        const cur = Math.round(window.scrollY)
        if (cur === last) {
          if (++same >= 2) break
        } else {
          same = 0
          last = cur
        }
      }
      await new Promise((r) => setTimeout(r, 620))
    }, y)

  const topOf = (sel) =>
    page.evaluate(
      (sel) => window.scrollY + document.querySelector(sel).getBoundingClientRect().top,
      sel,
    )

  const readPin = (sel, panelSel) =>
    page.evaluate(
      ({ sel, panelSel }) => {
        const track = document.querySelector(sel)
        const panel = track.querySelector(panelSel)
        const pr = panel.getBoundingClientRect()
        const active = track.querySelector('.pin-item[data-active="true"]')
        const ar = active ? active.getBoundingClientRect() : null
        const bar = track.querySelector('.pin-progress > i')
        const svg = track.querySelector('svg.a-anim')
        const g = svg ? svg.querySelector('g').getAttribute('transform') : null
        const d = svg ? svg.querySelector('path').getAttribute('d') : null
        return {
          panelTop: Math.round(pr.top),
          panelBottom: Math.round(pr.bottom),
          idx: [...track.querySelectorAll('.pin-item')].findIndex(
            (el) => el.dataset.active === 'true',
          ),
          p: bar ? +(getComputedStyle(bar).getPropertyValue('--p') || 0) : null,
          contentTop: ar ? Math.round(ar.top) : null,
          contentBottom: ar ? Math.round(ar.bottom) : null,
          rotate: g ? Math.round(parseFloat(/rotate\(([-\d.]+)/.exec(g)[1])) : null,
          dHead: d ? d.slice(0, 24) : null,
          after: track.dataset.after ?? null,
          vh: window.innerHeight,
        }
      },
      { sel, panelSel },
    )

  const sample = async (sel, panelSel, offsets) => {
    const anchor = await topOf(sel)
    const out = []
    for (const off of offsets) {
      await settleTo(anchor + off)
      out.push({ off, ...(await readPin(sel, panelSel)) })
    }
    return out
  }

  console.log('\n── 375x812, the pinned contract ──')

  for (const [sel, panelSel, name] of [
    ['.audience-track', '.audience-panel', 'audience'],
    ['.pin-track', '.pin-panel', 'what we do'],
    ['#how .pin-track', '.pin-panel', 'how it works'],
  ]) {
    /*
     * Offsets derived from the hold, not hardcoded pixels.
     *
     * These used to be [40, 150, 270, 390, 500]. A section with three steps instead of four
     * holds for 498px on a phone, so the last sample landed two pixels past the end, the
     * panel had correctly unstuck, and the audit reported a working pin as broken. The
     * distance a panel can hold is track height minus panel height; sampling as a fraction
     * of that stays correct whatever the sections are.
     */
    const hold = await page.evaluate(
      ([t, p]) =>
        document.querySelector(t).getBoundingClientRect().height -
        document.querySelector(p).getBoundingClientRect().height,
      [sel, panelSel],
    )
    // Stops at 0.85, not 1.0. The panel releases fractionally before the arithmetic end of
    // the track, so sampling the last few percent measures the handover, not the hold. The
    // old fixed 500px offset sat at roughly 0.85 of this section's hold, which is why it
    // worked before the sections changed.
    const s = await sample(sel, panelSel, [0.05, 0.25, 0.45, 0.65, 0.85].map((f) => Math.round(hold * f)))
    const tops = s.map((x) => x.panelTop)

    check(
      `${name}: the panel HOLDS STILL while the page scrolls`,
      new Set(tops).size === 1,
      `panelTop ${tops.join(', ')}`,
    )
    check(
      `${name}: it holds below the sticky nav, not underneath it`,
      tops[0] >= 58 && tops[0] <= 62,
      `${tops[0]}px`,
    )
    check(
      `${name}: the panel fits the viewport, nothing clipped off the bottom`,
      s[0].panelBottom <= s[0].vh + 1,
      `${s[0].panelBottom} vs ${s[0].vh}`,
    )

    if (name === 'audience') {
      const rots = s.map((x) => x.rotate)
      const heads = new Set(s.map((x) => x.dHead))
      check(
        'audience: the mark morphs while the reader is held',
        new Set(rots).size >= 2 && heads.size >= 2,
        `rotate ${rots.join(' -> ')}, ${heads.size} outline frames`,
      )
      check(
        'audience: the copy resolves DURING the hold',
        s[0].after === 'false' && s.at(-1).after === 'true',
        `after ${s.map((x) => x.after).join(' -> ')}`,
      )
    } else {
      const idxs = s.map((x) => x.idx)
      const ps = s.map((x) => x.p)
      check(
        `${name}: the active item advances one at a time`,
        new Set(idxs).size >= 3 && idxs.every((v, i) => i === 0 || v >= idxs[i - 1]),
        `idx ${idxs.join(' -> ')}`,
      )
      check(
        `${name}: the progress line advances with it`,
        ps.every((v, i) => i === 0 || v >= ps[i - 1]) && ps.at(-1) > ps[0],
        `p ${ps.map((v) => v.toFixed(2)).join(' -> ')}`,
      )
      check(
        `${name}: the active item is never clipped`,
        s.every((x) => x.contentTop >= tops[0] - 1 && x.contentBottom <= x.vh + 1),
      )
    }
  }

  // Reversibility: the same scroll position must give the same state either way.
  const audienceTop = await topOf('.audience-track')
  await settleTo(audienceTop + 40)
  const start = await readPin('.audience-track', '.audience-panel')
  await settleTo(audienceTop + 500)
  const end = await readPin('.audience-track', '.audience-panel')
  await settleTo(audienceTop + 40)
  const back = await readPin('.audience-track', '.audience-panel')
  check(
    'audience: scrubbing back up restores the earlier state',
    start.rotate === back.rotate && start.dHead === back.dHead && start.dHead !== end.dHead,
    `rotate ${start.rotate} -> ${end.rotate} -> ${back.rotate}, after ${start.after} -> ${end.after} -> ${back.after}`,
  )

  // The turn line still arrives.
  const turnBase = await topOf('.turn-track')
  const ops = []
  for (const off of [-700, -400, -150, 40]) {
    await settleTo(Math.max(0, turnBase + off))
    ops.push(
      await page.evaluate(
        () => +(+getComputedStyle(document.querySelector('.turn-line')).opacity).toFixed(2),
      ),
    )
  }
  check('turn line still fades in on mobile', ops[0] < 0.5 && ops.at(-1) > 0.9, `opacity ${ops.join(' -> ')}`)

  /**
   * Walk the page and, at every stop, look for text that is ON SCREEN yet invisible.
   *
   * Measuring at rest was wrong: `.turn-line` sits at opacity 0 by design until it enters,
   * so anything below the fold reads as stranded when it is simply waiting its turn. The
   * property that matters is whether something occupying the screen cannot be read.
   *
   * Inactive `.pin-item`s are excluded deliberately: exactly one is visible at a time and
   * that is the entire mechanism.
   */
  const stranded = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const found = []
    const H = document.documentElement.scrollHeight

    for (let y = 0; y < H; y += Math.floor(window.innerHeight * 0.4)) {
      window.scrollTo(0, y)
      await wait(520)

      for (const el of document.querySelectorAll('.turn-line, .reveal, .pin-item')) {
        if (el.textContent.trim().length < 20) continue
        if (el.classList.contains('pin-item') && el.dataset.active !== 'true') continue

        const r = el.getBoundingClientRect()
        const onScreen = r.bottom > 60 && r.top < window.innerHeight && r.width > 0
        if (!onScreen) continue

        if (+getComputedStyle(el).opacity < 0.08) {
          found.push({ y: Math.round(window.scrollY), text: el.textContent.trim().slice(0, 40) })
        }
      }
    }
    window.scrollTo(0, 0)
    return found
  })
  check(
    'no text is on screen yet invisible, anywhere down the page',
    stranded.length === 0,
    JSON.stringify(stranded.slice(0, 4)),
  )

  const screens = await page.evaluate(
    () => +(document.documentElement.scrollHeight / window.innerHeight).toFixed(1),
  )
  console.log(`   mobile home page: ${screens} screens`)

  await ctx.close()
}
