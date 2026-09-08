import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendDeliveredEmail = vi.fn()
vi.mock('@/lib/delivery-notify', () => ({
  sendDeliveredEmail: (...a: unknown[]) => sendDeliveredEmail(...a),
}))

const { POST } = await import('@/app/api/song-delivered/route')

const SECRET = 'shh'

const DELIVERED = {
  table: 'song_jobs',
  record: {
    status: 'delivered', title: 'T', primary_artist: 'A',
    source_language: 'es', target_language: 'en', user_id: 'u1',
  },
  old_record: { status: 'in_progress' },
}

function req(body: unknown, secret: string | null = SECRET) {
  return new Request('http://x/api/song-delivered', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-delivery-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  sendDeliveredEmail.mockReset()
  process.env.DELIVERY_WEBHOOK_SECRET = SECRET
})

describe('POST /api/song-delivered', () => {
  it('404s without the shared secret', async () => {
    const res = await POST(req(DELIVERED, null))
    expect(res.status).toBe(404)
    expect(sendDeliveredEmail).not.toHaveBeenCalled()
  })

  it('emails once on the transition into delivered', async () => {
    sendDeliveredEmail.mockResolvedValue(true)
    const res = await POST(req(DELIVERED))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, sent: true })
    expect(sendDeliveredEmail).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'T', user_id: 'u1' }),
    )
  })

  it('does not re-email when it was already delivered', async () => {
    const res = await POST(req({ ...DELIVERED, old_record: { status: 'delivered' } }))
    expect(await res.json()).toEqual({ ok: true, sent: false })
    expect(sendDeliveredEmail).not.toHaveBeenCalled()
  })

  it('ignores updates that are not a delivery', async () => {
    const res = await POST(
      req({ table: 'song_jobs', record: { status: 'in_progress' }, old_record: { status: 'approved' } }),
    )
    expect(await res.json()).toEqual({ ok: true, sent: false })
    expect(sendDeliveredEmail).not.toHaveBeenCalled()
  })
})
