import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'https://lyricalglobal.com'
const b = await chromium.launch()
const p = await (await b.newContext()).newPage()

const fails = []
const ck = (n, ok, d) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  ${d}` : ''}`)
  if (!ok) fails.push(n)
}

const attempt = async (password) => {
  await p.goto(`${BASE}/leads`, { waitUntil: 'networkidle' })
  const form = p.locator('form').first()
  await form.locator('input[name="password"]').fill(password)
  await Promise.all([
    p.waitForLoadState('networkidle'),
    form.locator('button[type="submit"]').click(),
  ])
  await p.waitForTimeout(400)
  const text = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
  return {
    url: p.url(),
    wrong: text.includes('That password is not right'),
    throttled: text.includes('Too many attempts'),
    signedIn: text.includes('Sign out'),
  }
}

console.log('Six wrong-password attempts against', BASE)
const results = []
for (let i = 1; i <= 6; i++) {
  const r = await attempt(`definitely-not-the-password-${i}`)
  results.push(r)
  console.log(`  ${i}: wrong=${r.wrong} throttled=${r.throttled} signedIn=${r.signedIn}`)
}

ck('a wrong password is rejected', results[0].wrong && !results[0].signedIn)
ck('no wrong password ever signs anybody in', results.every((r) => !r.signedIn))
ck(
  'the sixth attempt is throttled rather than checked',
  results[5].throttled,
  `attempt 6 throttled=${results[5].throttled}`,
)
ck(
  'throttling kicks in only after several attempts',
  results.slice(0, 4).every((r) => !r.throttled),
)

await b.close()
console.log('\n' + '='.repeat(46))
console.log(fails.length ? `${fails.length} FAILED:\n${fails.map((f) => '  - ' + f).join('\n')}` : 'ALL PASS')
if (fails.length) process.exitCode = 1
