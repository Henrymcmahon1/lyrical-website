/**
 * Enquiry form audit. Proves the form never silently swallows a lead.
 *
 * The interesting case is the one that is live right now: with neither Supabase nor Resend
 * configured the route returns 503, and a form that says "email us instead" while throwing
 * away what the visitor typed is how an enquiry is lost. So this asserts the 503 path offers
 * a prefilled mailto carrying every field, and that a fixable 400 does NOT (a validation
 * error should send them back to the field, not out to their mail client).
 *
 * Run against a server with no RESEND_API_KEY to exercise the 503 branch.
 *
 *   node scripts/audit-enquiry.mjs http://localhost:3000
 */
import { chromium } from 'playwright'
const BASE = process.argv[2]
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const fails = []
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  ${d}` : ''}`); if (!ok) fails.push(n) }

await page.goto(BASE + '/#enquire', { waitUntil: 'networkidle' })
await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })

const form = page.locator('form[action="/api/enquiry"]').last()

/*
 * Only name and email are asked for up front. Everything else lives inside a collapsed
 * <details>, so the first thing to prove is that the visitor really is shown two inputs and
 * a button, and that nothing optional carries `required`. A form that collapsed the fields
 * but still refused to submit without them would be worse than the version it replaced.
 */
const optional = form.locator('details')
check('the optional questions start collapsed', !(await optional.evaluate((d) => d.open)))
check(
  'only name and email are required',
  (await form.locator('[required]').count()) === 2,
  `${await form.locator('[required]').count()} required fields`,
)
for (const n of ['role', 'company', 'catalogue_size', 'message']) {
  const req = await form.locator(`[name="${n}"]`).getAttribute('required')
  check(`${n} is optional`, req === null)
}
check(
  'role is not pre-answered on the visitor’s behalf',
  (await form.locator('select[name="role"]').inputValue()) === '',
)

await form.locator('input[name="name"]').fill('Preflight Tester')
await form.locator('input[name="email"]').fill('preflight@example.com')

// Open the disclosure before touching anything inside it. Playwright will not act on a
// hidden control, which is the correct behaviour and the reason this step is explicit.
await optional.locator('summary').click()
await form.locator('select[name="role"]').selectOption('label')
await form.locator('input[name="company"]').fill('Example Records & Co')
await form.locator('select[name="catalogue_size"]').selectOption('11-100')
await form.locator('input[name="target_languages"][value="ES"]').check({ force: true })
await form.locator('textarea[name="message"]').fill('Line one.\nLine two with an & ampersand and a ? question.')
await page.waitForTimeout(2500)   // clear the MIN_ELAPSED_MS bot gate

const [res] = await Promise.all([
  page.waitForResponse((r) => r.url().includes('/api/enquiry') && r.request().method() === 'POST'),
  form.locator('button[type="submit"]').click(),
])
check('route returns 503 while unconfigured (the live condition)', res.status() === 503, `HTTP ${res.status()}`)

const alert = form.locator('[role="alert"]')
await alert.waitFor({ state: 'visible', timeout: 5000 })
check('an error is announced to assistive tech', await alert.isVisible())

const link = alert.locator('a[href^="mailto:"]')
const hasLink = await link.count() > 0
check('the mailto fallback is offered', hasLink)

if (hasLink) {
  const href = await link.getAttribute('href')
  const u = new URL(href)
  const body = u.searchParams.get('body') ?? ''
  /**
   * Asserted against the address the page itself shows, not a literal copied into this
   * script. A hardcoded address here drifts the moment CONTACT_EMAIL changes, and then the
   * audit fails for a reason that has nothing to do with the behaviour it is checking. The
   * property that matters is that the link goes where the visitor was just told to write.
   */
  const shown = (await alert.innerText()).match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0]
  check('the fallback names a contact address to the visitor', Boolean(shown), shown)
  check('addressed to the address the page shows', u.pathname === shown, `${u.pathname} vs ${shown}`)
  /*
    Assert the RULE, not a snapshot of it.

    This line used to compare against the literal "Lyrical enquiry: Preflight Tester (label)",
    so renaming the brand to lowercase failed an audit that has nothing to do with casing.
    That is the third time in this repo an audit has broken for a reason unrelated to what it
    was written to protect.

    What actually matters here is that a founder opening the fallback email can tell who it is
    from and route it: the subject must be labelled as an enquiry and carry the name and the
    role. The exact string is pinned by tests/enquiry-email.test.ts, which is the right place
    for it.
  */
  const subject = u.searchParams.get('subject') ?? ''
  check(
    'subject carries name and role',
    /enquiry/i.test(subject) && subject.includes('Preflight Tester') && subject.includes('label'),
    subject,
  )
  check('body carries the email', body.includes('preflight@example.com'))
  check('body carries the company, ampersand intact', body.includes('Example Records & Co'))
  check('body carries the catalogue size', body.includes('11-100'))
  check('body carries the chosen language', body.includes('ES'))
  check('body carries the multi-line message with & and ?', body.includes('Line one.\nLine two with an & ampersand and a ? question.'))
  check('the raw href is fully percent-encoded', !/\n/.test(href) && href.includes('%0A'))
  check('tap target is at least 44px', (await link.boundingBox()).height >= 44, `${Math.round((await link.boundingBox()).height)}px`)
  check('link is visible, not clipped off screen', await link.isVisible())
}

// A validation error must NOT offer the fallback: that field is fixable.
await page.goto(BASE + '/#enquire', { waitUntil: 'networkidle' })
const f2 = page.locator('form[action="/api/enquiry"]').last()
await f2.locator('input[name="name"]').fill('X')   // fails minLength 2 server-side
await f2.locator('input[name="email"]').fill('someone@example.com')
await page.waitForTimeout(2500)
await f2.locator('input[name="name"]').evaluate((el) => el.setAttribute('minlength', '1'))
const [res2] = await Promise.all([
  page.waitForResponse((r) => r.url().includes('/api/enquiry') && r.request().method() === 'POST'),
  f2.locator('button[type="submit"]').click(),
])
check('a 400 validation error still returns 400', res2.status() === 400, `HTTP ${res2.status()}`)
await page.waitForTimeout(600)
check('no fallback offered for a fixable field', await f2.locator('[role="alert"] a[href^="mailto:"]').count() === 0)

await b.close()
console.log('\n' + '='.repeat(50))
console.log(fails.length ? `${fails.length} FAILED:\n${fails.map(f => '  - ' + f).join('\n')}` : 'ALL PASS')
if (fails.length) process.exitCode = 1
