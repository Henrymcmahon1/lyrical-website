import { describe, expect, it } from 'vitest'
import { safePath } from '@/app/auth/callback/route'

/**
 * The magic link callback hands out a session, and it takes its redirect target from the URL.
 * Without a guard that is an open redirect on our own domain, arriving BY EMAIL with our name
 * in front of it, which is the exact shape a phishing link wants.
 */
describe('the magic link redirect target', () => {
  it('allows an ordinary path on this site', () => {
    expect(safePath('/studio')).toBe('/studio')
    expect(safePath('/studio/jobs?new=1')).toBe('/studio/jobs?new=1')
  })

  it('falls back when nothing is asked for', () => {
    expect(safePath(null)).toBe('/studio')
    expect(safePath('')).toBe('/studio')
  })

  it('refuses to send anybody to another origin', () => {
    for (const hostile of [
      'https://evil.com',
      'http://evil.com',
      '//evil.com', // protocol-relative: a browser reads this as a host, not a path
      '//evil.com/studio',
      'javascript:alert(1)',
      'studio', // no leading slash, resolves relative and is not what we mean
    ]) {
      expect(safePath(hostile), `should not follow ${hostile}`).toBe('/studio')
    }
  })
})
