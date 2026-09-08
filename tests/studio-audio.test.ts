import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Signing a customer's finished cover.
 *
 * The behaviour that matters is the refusal: a delivery that is not the caller's, a malformed
 * id, or a signing failure must all resolve to null (a 404 in the route), never to somebody
 * else's cover and never to a thrown 500 on a page they already opened.
 */

const maybeSingle = vi.fn()
const createSignedUrl = vi.fn()
const eqUser = () => ({ maybeSingle: (...a: unknown[]) => maybeSingle(...a) })
const eqId = () => ({ eq: () => eqUser() })

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => eqId() }) }),
    storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(...a) }) },
  }),
}))

const { signDelivery, DELIVERIES_BUCKET } = await import('@/lib/deliveries')

const UID = '11111111-1111-1111-1111-111111111111'
const DID = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  maybeSingle.mockReset()
  createSignedUrl.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('signDelivery', () => {
  it('signs a short-lived URL for a delivery the caller owns', async () => {
    maybeSingle.mockResolvedValue({ data: { path: 'u/j/cover.mp3' }, error: null })
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://sb/cover?token=x' }, error: null })

    const url = await signDelivery(UID, DID)
    expect(url).toBe('https://sb/cover?token=x')
    // 600s: long enough to play, short enough that an escaped URL is dead fast.
    expect(createSignedUrl).toHaveBeenCalledWith('u/j/cover.mp3', 600)
  })

  it('returns null when the delivery is not the caller’s, or does not exist', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await signDelivery(UID, DID)).toBeNull()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns null for a malformed id without touching the database', async () => {
    expect(await signDelivery(UID, 'not-a-uuid')).toBeNull()
    expect(maybeSingle).not.toHaveBeenCalled()
  })

  it('returns null, and does not throw, when signing fails', async () => {
    maybeSingle.mockResolvedValue({ data: { path: 'u/j/cover.mp3' }, error: null })
    createSignedUrl.mockResolvedValue({ data: null, error: { message: 'nope' } })
    await expect(signDelivery(UID, DID)).resolves.toBeNull()
  })

  it('signs against the private deliveries bucket', () => {
    expect(DELIVERIES_BUCKET).toBe('deliveries')
  })
})
