import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Signing the /listen recordings.
 *
 * The behaviour that matters is what happens when things are NOT fine. This page is opened in
 * front of a prospect, so every failure has to degrade to "not loaded yet" on a page that
 * still renders. A thrown error here is a 500 in the middle of a sales call.
 */

const createSignedUrls = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    storage: { from: () => ({ createSignedUrls: (...a: unknown[]) => createSignedUrls(...a) }) },
  }),
}))

const { signListenTracks, LISTEN_BUCKET } = await import('@/lib/listen-audio')

const KEYS = ['original.mp3', 'artist-spanish.mp3', 'lyrical-spanish.mp3']

beforeEach(() => {
  createSignedUrls.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('signListenTracks', () => {
  it('returns a signed URL for each object that exists', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'original.mp3', signedUrl: 'https://sb/original?token=a', error: null },
        { path: 'artist-spanish.mp3', signedUrl: 'https://sb/artist?token=b', error: null },
        { path: 'lyrical-spanish.mp3', signedUrl: null, error: 'Object not found' },
      ],
      error: null,
    })

    const out = await signListenTracks(KEYS)
    expect(out).toEqual([
      { key: 'original.mp3', url: 'https://sb/original?token=a' },
      { key: 'artist-spanish.mp3', url: 'https://sb/artist?token=b' },
      // The one that is not uploaded yet resolves to null, not to a broken URL.
      { key: 'lyrical-spanish.mp3', url: null },
    ])
  })

  it('keeps the requested order, whatever order storage answers in', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'artist-spanish.mp3', signedUrl: 'https://sb/artist', error: null },
        { path: 'original.mp3', signedUrl: 'https://sb/original', error: null },
      ],
      error: null,
    })
    const out = await signListenTracks(['original.mp3', 'artist-spanish.mp3'])
    expect(out.map((o) => o.key)).toEqual(['original.mp3', 'artist-spanish.mp3'])
  })

  it('reports everything absent when storage returns an error', async () => {
    createSignedUrls.mockResolvedValue({ data: null, error: { message: 'bucket not found' } })
    const out = await signListenTracks(KEYS)
    expect(out.every((o) => o.url === null)).toBe(true)
  })

  it('does not throw when storage is unreachable', async () => {
    createSignedUrls.mockRejectedValue(new Error('ECONNREFUSED'))
    // A thrown error here is a 500 on a page somebody already unlocked, in front of a buyer.
    await expect(signListenTracks(KEYS)).resolves.toEqual(
      KEYS.map((key) => ({ key, url: null })),
    )
  })

  it('does not throw when Supabase is not configured at all', async () => {
    createSignedUrls.mockImplementation(() => {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    })
    await expect(signListenTracks(KEYS)).resolves.toEqual(
      KEYS.map((key) => ({ key, url: null })),
    )
  })

  it('signs against the private bucket', async () => {
    createSignedUrls.mockResolvedValue({ data: [], error: null })
    await signListenTracks(KEYS)
    expect(LISTEN_BUCKET).toBe('listen')
    // Expiry is passed in seconds and must outlive a session, or playback dies mid-meeting.
    expect(createSignedUrls).toHaveBeenCalledWith(KEYS, 4 * 60 * 60)
  })
})
