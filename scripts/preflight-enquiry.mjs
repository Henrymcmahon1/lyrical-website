/**
 * Is the enquiry pipeline actually wired?
 *
 * Reports which of the five environment variables exist on Vercel, per environment, and what
 * that means for a visitor submitting the form. Optionally sends one clearly-labelled test
 * enquiry so you can watch it land in the inbox and the table.
 *
 *   node scripts/preflight-enquiry.mjs
 *   node scripts/preflight-enquiry.mjs --smoke
 *   node scripts/preflight-enquiry.mjs --smoke --url https://lyrical-website.vercel.app
 *
 * Reads no secret values, only whether a name exists. `--smoke` writes a real row and sends a
 * real email, so it is opt-in.
 */
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const smoke = args.includes('--smoke')
const urlFlag = args.indexOf('--url')
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : 'https://lyrical-website.vercel.app'

const REQUIRED = {
  SUPABASE_URL: 'stores the lead in the enquiries table',
  SUPABASE_SERVICE_ROLE_KEY: 'the service_role key, NOT anon. Bypasses RLS',
  RESEND_API_KEY: 'sends the notification email',
  ENQUIRY_TO_EMAIL: 'where the notification goes',
  ENQUIRY_FROM_EMAIL: 'the sender. onboarding@resend.dev until a domain is verified',
  GATE_SECRET: 'signs the "asked for examples" cookie',
}

console.log(`Preflight for ${BASE}\n`)

// ── 1. Which names exist on Vercel ───────────────────────────────────────────
let listing = ''
try {
  // execSync with a single command string, not execFileSync with `shell: true`. The latter
  // concatenates args into a shell line, which is what DEP0190 warns about.
  listing = execSync('npx vercel env ls', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch {
  console.log('Could not read Vercel env vars. Run `npx vercel login` and `npx vercel link` first.\n')
}

const envsFor = (name) =>
  listing
    .split('\n')
    .filter((line) => new RegExp(`^\\s*${name}\\s`).test(line))
    .map((line) => {
      const m = /(Development|Preview|Production)/g
      return line.match(m) ?? []
    })
    .flat()

const missing = []
console.log('Environment variables on Vercel')
console.log('-'.repeat(74))
for (const [name, why] of Object.entries(REQUIRED)) {
  const envs = [...new Set(envsFor(name))]
  const ok = envs.includes('Production')
  if (!ok) missing.push(name)
  console.log(
    `  ${ok ? 'SET  ' : 'MISS '} ${name.padEnd(27)} ${(envs.join(', ') || 'nowhere').padEnd(34)}`,
  )
  if (!ok) console.log(`        ^ ${why}`)
}

// ── 2. What that means for a visitor ─────────────────────────────────────────
const storage = !missing.includes('SUPABASE_URL') && !missing.includes('SUPABASE_SERVICE_ROLE_KEY')
const mail =
  !missing.includes('RESEND_API_KEY') &&
  !missing.includes('ENQUIRY_TO_EMAIL') &&
  !missing.includes('ENQUIRY_FROM_EMAIL')

console.log('\nWhat a visitor gets')
console.log('-'.repeat(74))
if (storage && mail) console.log('  200. Row written and email sent. Fully wired.')
else if (storage) console.log('  200. Row written, no email. The table is the only record.')
else if (mail) console.log('  200. Email sent, nothing stored. The inbox is the only record.')
else
  console.log(
    '  503. The form is REFUSING every enquiry.\n' +
      '       The prefilled mailto fallback catches the lead, but the visitor has to\n' +
      '       take a second step, and most will not.',
  )

if (missing.length) {
  console.log('\nTo finish, paste these (each command prompts for the value)')
  console.log('-'.repeat(74))
  for (const name of missing) {
    console.log(`  npx vercel env add ${name} production`)
  }
  console.log('\n  Then redeploy so the new values are picked up:')
  console.log('  npx vercel --prod')
  console.log('\n  Supabase: create a project, run supabase/schema.sql in the SQL editor,')
  console.log('  then Settings > API for the URL and the service_role key.')
  console.log('  Resend: register with the address in ENQUIRY_TO_EMAIL, then create an API key.')
  console.log('  Until a domain is verified in Resend, it can only deliver to that address.')
}

// ── 3. Optional live smoke test ──────────────────────────────────────────────
if (smoke) {
  console.log('\nSmoke test')
  console.log('-'.repeat(74))
  const stamp = new Date().toISOString()
  const res = await fetch(`${BASE}/api/enquiry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'PREFLIGHT TEST, safe to delete',
      email: 'henry.jamcmahon@gmail.com',
      role: 'other',
      company: 'Preflight',
      catalogue_size: 'unsure',
      target_languages: [],
      message: `Automated preflight at ${stamp}. Safe to delete this row.`,
      source: 'preflight',
      unlocked_audio: false,
      website: '',
      elapsed_ms: 9000,
    }),
  })
  const body = await res.text()
  console.log(`  HTTP ${res.status}  ${body.slice(0, 160)}`)
  if (res.status === 200) {
    console.log('  Check the inbox, and the enquiries table. Delete the test row when happy.')
  }
}

console.log('')
process.exitCode = missing.length ? 1 : 0
