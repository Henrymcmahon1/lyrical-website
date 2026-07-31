import { chromium } from 'playwright'

const BASE = 'https://lyricalglobal.com'
const b = await chromium.launch()
const ctx = await b.newContext({ acceptDownloads: true })
const p = await ctx.newPage()

const fails = []
const ck = (n, ok, d) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  ${d}` : ''}`)
  if (!ok) fails.push(n)
}

// 1. Sign in.
await p.goto(`${BASE}/leads`, { waitUntil: 'networkidle' })
const form = p.locator('form').first()
await form.locator('input[name="password"]').fill('Lyrical2026$')
await form.locator('button[type="submit"]').click()
await p.waitForTimeout(3500)

const text = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
ck('the password signs in', text.includes('Sign out'), p.url())
ck('the enquiry that was just submitted is listed', text.includes('Post-SQL Check'))
ck('it shows the email address', text.includes('henry.jamcmahon@gmail.com'))
ck('it shows the message body', text.includes('Automated check after the schema was run'))
ck('it shows the chosen language', text.includes('ES'))

// 2. CSV export, now that there is a session.
const [download] = await Promise.all([
  p.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  p.locator('a[href="/leads/export"]').click(),
])
if (download) {
  const stream = await download.createReadStream()
  let csv = ''
  for await (const chunk of stream) csv += chunk
  ck('CSV downloads with a sensible filename', /lyrical-enquiries-\d{4}-\d{2}-\d{2}\.csv/.test(download.suggestedFilename()), download.suggestedFilename())
  ck('CSV has the header row', csv.startsWith('created_at,name,email'))
  ck('CSV contains the enquiry', csv.includes('Post-SQL Check'))
} else {
  ck('CSV downloads', false, 'no download event fired')
}

// 3. Mark handled, and confirm it leaves the default view.
await p.goto(`${BASE}/leads`, { waitUntil: 'networkidle' })
const markBtn = p.locator('button', { hasText: 'Mark handled' }).first()
if (await markBtn.count()) {
  await markBtn.click()
  await p.waitForTimeout(3500)
  const after = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
  ck('marking handled removes it from the to-handle view', !after.includes('Post-SQL Check'))

  await p.goto(`${BASE}/leads?show=all`, { waitUntil: 'networkidle' })
  const all = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
  ck('it is still there under Everything, marked handled', all.includes("Post-SQL Check") && /handled/i.test(all))
} else {
  ck('a mark-handled button exists', false)
}

// 4. Sign out really ends the session.
await p.goto(`${BASE}/leads`, { waitUntil: 'networkidle' })
const out = p.locator('button', { hasText: 'Sign out' }).first()
if (await out.count()) {
  await out.click()
  await p.waitForTimeout(3000)
  const signedOut = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
  ck('signing out returns to the password form', signedOut.includes('Password protected') && !signedOut.includes('Sign out'))

  const res = await p.request.get(`${BASE}/leads/export`)
  ck('CSV export is refused after signing out', res.status() === 404, `HTTP ${res.status()}`)
}

await b.close()
console.log('\n' + '='.repeat(50))
console.log(fails.length ? `${fails.length} FAILED:\n${fails.map((f) => '  - ' + f).join('\n')}` : 'ALL PASS')
if (fails.length) process.exitCode = 1
