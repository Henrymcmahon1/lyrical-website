import { describe, expect, it } from 'vitest'
import { ARTIST_EOI_SOURCE, EoiSchema, toEnquiry } from '@/lib/eoi-schema'
import { EnquirySchema } from '@/lib/enquiry-schema'

const valid = {
  name: 'Coffey Anderson',
  artistName: 'Coffey Anderson',
  email: 'Coffey@Example.com',
  role: 'artist',
  catalogue_size: '11-100',
  monthlyStreamsBand: '100k-1m',
  target_languages: ['ES', 'PT'],
  links: 'https://open.spotify.com/artist/abc\nhttps://instagram.com/coffey',
  message: 'Ready when you are.',
}

describe('EoiSchema', () => {
  it('accepts a full submission, lowercases the email, splits links by line', () => {
    const r = EoiSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.email).toBe('coffey@example.com')
      expect(r.data.links).toEqual([
        'https://open.spotify.com/artist/abc',
        'https://instagram.com/coffey',
      ])
    }
  })

  it('requires name, artist name, email and a streams band', () => {
    for (const bad of [{ name: '' }, { artistName: '' }, { email: 'nope' }, { monthlyStreamsBand: '' }]) {
      expect(EoiSchema.safeParse({ ...valid, ...bad }).success).toBe(false)
    }
  })

  it('accepts links as an array, caps at three, rejects non-http', () => {
    expect(
      EoiSchema.safeParse({ ...valid, links: ['https://a.example', 'https://b.example'] }).success,
    ).toBe(true)
    expect(
      EoiSchema.safeParse({
        ...valid,
        links: 'https://a.example\nhttps://b.example\nhttps://c.example\nhttps://d.example',
      }).success,
    ).toBe(false)
    expect(EoiSchema.safeParse({ ...valid, links: 'not a url' }).success).toBe(false)
    expect(EoiSchema.safeParse({ ...valid, links: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('maps a blank role to other, a blank catalog size to undefined, rejects unknown languages', () => {
    const r = EoiSchema.safeParse({ ...valid, role: '', catalogue_size: '' })
    expect(r.success && r.data.role).toBe('other')
    expect(r.success && r.data.catalogue_size).toBeUndefined()
    expect(EoiSchema.safeParse({ ...valid, target_languages: ['XX'] }).success).toBe(false)
  })
})

describe('toEnquiry', () => {
  const d = EoiSchema.parse(valid)

  it('produces a payload the enquiry route accepts, tagged artist_eoi, act in company', () => {
    const p = toEnquiry(d)
    expect(p.source).toBe(ARTIST_EOI_SOURCE)
    expect(p.company).toBe('Coffey Anderson')
    expect(EnquirySchema.safeParse({ ...p, elapsed_ms: 9000, website: '' }).success).toBe(true)
  })

  it('folds the artist answers into the message as labelled lines, then the free text', () => {
    expect(toEnquiry(d).message).toBe(
      'Artist or act: Coffey Anderson\nMonthly streams: 100k to 1m\nLinks: https://open.spotify.com/artist/abc | https://instagram.com/coffey\n\nReady when you are.',
    )
    expect(toEnquiry(EoiSchema.parse({ ...valid, links: '', message: '' })).message).toBe(
      'Artist or act: Coffey Anderson\nMonthly streams: 100k to 1m\nLinks: -',
    )
  })
})
