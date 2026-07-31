/**
 * Interactive setter for the secrets that only you can supply.
 *
 *   node scripts/set-keys.mjs
 *
 * Prompts for each value and writes it to Vercel across production, preview and development.
 * The values are piped to `vercel env add` on stdin with no trailing newline, because a stray
 * newline inside an API key fails at request time in a way that is very hard to diagnose.
 *
 * Nothing is echoed back, written to a file, or left in your shell history.
 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'

/**
 * Windows refuses to spawn a `.cmd` without a shell, so `shell: true` is unavoidable for
 * `npx`. That makes Node emit DEP0190, which warns that arguments are concatenated rather
 * than escaped. It does not apply here: every argument below is a fixed string from the
 * WANTED and ENVIRONMENTS lists in this file, and the secret itself never becomes an
 * argument, only stdin. Silenced so it does not read as something being wrong.
 */
process.removeAllListeners('warning')
process.on('warning', (w) => {
  if (w.code !== 'DEP0190') console.warn(`${w.name}: ${w.message}`)
})

const ENVIRONMENTS = ['production', 'preview', 'development']

const WANTED = [
  {
    name: 'SUPABASE_URL',
    hint: 'Supabase > Settings > API. Looks like https://xxxx.supabase.co',
    check: (v) => (/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(v) ? null : 'Expected https://<something>.supabase.co'),
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    hint: 'The SECRET key (sb_secret_...) or the legacy service_role JWT. NOT the anon key.',
    check: (v) =>
      v.startsWith('sb_secret_') || v.startsWith('eyJ')
        ? null
        : 'Expected a key starting sb_secret_ or a JWT starting eyJ. The anon/publishable key will not work.',
  },
  {
    name: 'RESEND_API_KEY',
    hint: 'Resend > API Keys. Starts re_',
    check: (v) => (v.startsWith('re_') ? null : 'Expected a key starting re_'),
  },
  {
    name: 'ADMIN_PASSWORD',
    hint: 'Your own choice. Opens /leads. Make it long, you only type it twice a week.',
    check: (v) =>
      v.length >= 12
        ? null
        : 'Use at least 12 characters. This one guards other people’s contact details.',
  },
]

const rl = createInterface({ input: stdin, output: stdout })
const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())))

/** Run a vercel subcommand, optionally feeding it a value on stdin. */
function vercel(args, input) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['vercel', ...args], {
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      shell: true,
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    if (input !== undefined) {
      child.stdin.write(input) // no newline, deliberately
      child.stdin.end()
    }
    child.on('close', (code) => resolve({ code, out }))
  })
}

console.log(`\nSetting ${WANTED.length} values across ${ENVIRONMENTS.length} environments.`)
console.log('Paste each value and press Enter. Nothing is stored locally.\n')

const values = {}
for (const item of WANTED) {
  console.log(`\n${item.name}`)
  console.log(`  ${item.hint}`)
  for (;;) {
    const v = await ask('  value: ')
    if (!v) {
      console.log('  Empty. Try again, or Ctrl+C to stop.')
      continue
    }
    const problem = item.check(v)
    if (problem) {
      console.log(`  ${problem}`)
      const anyway = await ask('  Use it anyway? (y/N): ')
      if (anyway.toLowerCase() !== 'y') continue
    }
    values[item.name] = v
    break
  }
}
rl.close()

console.log('\nWriting to Vercel...\n')
let failed = 0
for (const [name, value] of Object.entries(values)) {
  for (const env of ENVIRONMENTS) {
    // Remove any existing value first so re-running this script is safe.
    await vercel(['env', 'rm', name, env, '--yes'])
    const { code, out } = await vercel(['env', 'add', name, env], value)
    if (code === 0) {
      console.log(`  ok    ${name} -> ${env}`)
    } else {
      failed++
      console.log(`  FAIL  ${name} -> ${env}`)
      console.log(`        ${out.split('\n').filter(Boolean).slice(-2).join(' | ')}`)
    }
  }
}

console.log(
  failed
    ? `\n${failed} write(s) failed. Check you are logged in: npx vercel whoami\n`
    : `\nAll ${WANTED.length * ENVIRONMENTS.length} writes succeeded.\n\nNext:\n  npx vercel --prod --yes\n  node scripts/preflight-enquiry.mjs --smoke\n`,
)
process.exitCode = failed ? 1 : 0
