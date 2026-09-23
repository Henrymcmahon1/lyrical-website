import { afterEach, describe, expect, it } from 'vitest'
import { adminAllowlist, breakGlassEnabled, isAllowlisted, requiredAal } from '@/lib/admin-identity'

/**
 * The pure half of admin sign-in: who is on the list, whether 2FA is demanded, and whether the
 * old shared password is switched on. Every one of these FAILS CLOSED.
 */

const CONFIRMED = '2026-09-24T00:00:00Z'

afterEach(() => {
  delete process.env.ADMIN_EMAILS
  delete process.env.ADMIN_REQUIRE_MFA
  delete process.env.ADMIN_BREAK_GLASS
  delete process.env.ADMIN_PASSWORD
})

describe('adminAllowlist', () => {
  it('is empty when ADMIN_EMAILS is unset, so nobody is an admin', () => {
    expect(adminAllowlist()).toEqual([])
  })

  it('is empty when ADMIN_EMAILS is an empty string', () => {
    process.env.ADMIN_EMAILS = ''
    expect(adminAllowlist()).toEqual([])
  })

  it('is empty when ADMIN_EMAILS is only commas and spaces', () => {
    process.env.ADMIN_EMAILS = ' , ,  '
    expect(adminAllowlist()).toEqual([])
  })

  it('trims spaces and lower-cases every entry', () => {
    process.env.ADMIN_EMAILS = '  Info@LyricalGlobal.com ,HENRY@example.com  '
    expect(adminAllowlist()).toEqual(['info@lyricalglobal.com', 'henry@example.com'])
  })
})

describe('isAllowlisted', () => {
  it('lets nobody in when the list is unset', () => {
    expect(isAllowlisted('info@lyricalglobal.com', CONFIRMED)).toBe(false)
  })

  it('matches exactly, ignoring case', () => {
    process.env.ADMIN_EMAILS = 'info@lyricalglobal.com'
    expect(isAllowlisted('INFO@lyricalglobal.COM', CONFIRMED)).toBe(true)
  })

  it('ignores surrounding spaces on the address being checked', () => {
    process.env.ADMIN_EMAILS = 'info@lyricalglobal.com'
    expect(isAllowlisted('  info@lyricalglobal.com ', CONFIRMED)).toBe(true)
  })

  it('refuses a near miss: a suffix, a prefix or another domain', () => {
    process.env.ADMIN_EMAILS = 'info@lyricalglobal.com'
    for (const email of [
      'xinfo@lyricalglobal.com',
      'info@lyricalglobal.com.evil.test',
      'info@lyricalglobal.co',
      'lyricalglobal.com',
    ]) {
      expect(isAllowlisted(email, CONFIRMED)).toBe(false)
    }
  })

  it('refuses an unconfirmed email even when it is on the list', () => {
    process.env.ADMIN_EMAILS = 'info@lyricalglobal.com'
    expect(isAllowlisted('info@lyricalglobal.com', null)).toBe(false)
    expect(isAllowlisted('info@lyricalglobal.com', undefined)).toBe(false)
    expect(isAllowlisted('info@lyricalglobal.com', '')).toBe(false)
  })

  it('refuses a missing email', () => {
    process.env.ADMIN_EMAILS = 'info@lyricalglobal.com'
    expect(isAllowlisted(null, CONFIRMED)).toBe(false)
    expect(isAllowlisted(undefined, CONFIRMED)).toBe(false)
    expect(isAllowlisted('', CONFIRMED)).toBe(false)
  })
})

describe('requiredAal', () => {
  it('is aal1 by default', () => {
    expect(requiredAal()).toBe('aal1')
  })

  it('is aal2 when ADMIN_REQUIRE_MFA=on', () => {
    process.env.ADMIN_REQUIRE_MFA = 'on'
    expect(requiredAal()).toBe('aal2')
  })

  it('stays aal1 for anything other than exactly "on"', () => {
    for (const v of ['off', '', 'true', '1', 'ON ']) {
      process.env.ADMIN_REQUIRE_MFA = v
      expect(requiredAal()).toBe('aal1')
    }
  })
})

describe('breakGlassEnabled', () => {
  it('is OFF by default', () => {
    expect(breakGlassEnabled()).toBe(false)
  })

  it('is OFF when a password is set but the flag is not', () => {
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    expect(breakGlassEnabled()).toBe(false)
  })

  it('is OFF when the flag is on but there is no password', () => {
    process.env.ADMIN_BREAK_GLASS = 'on'
    expect(breakGlassEnabled()).toBe(false)
  })

  it('is ON only with the flag exactly "on" AND a password', () => {
    process.env.ADMIN_BREAK_GLASS = 'on'
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    expect(breakGlassEnabled()).toBe(true)
    process.env.ADMIN_BREAK_GLASS = 'yes'
    expect(breakGlassEnabled()).toBe(false)
  })
})
