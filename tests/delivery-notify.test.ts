import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserById = vi.fn()
const mailCustomer = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ auth: { admin: { getUserById: (...a: unknown[]) => getUserById(...a) } } }),
}))
vi.mock('@/lib/mailer', () => ({ mailCustomer: (...a: unknown[]) => mailCustomer(...a) }))

const { sendDeliveredEmail } = await import('@/lib/delivery-notify')

const JOB = {
  title: 'Callaita', primary_artist: 'Bad Bunny',
  source_language: 'es', target_language: 'en', user_id: 'u1',
}

beforeEach(() => {
  getUserById.mockReset()
  mailCustomer.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sendDeliveredEmail', () => {
  it('sends the delivered email to the job owner', async () => {
    getUserById.mockResolvedValue({ data: { user: { email: 'a@b.com' } }, error: null })
    mailCustomer.mockResolvedValue(true)

    const ok = await sendDeliveredEmail(JOB)
    expect(ok).toBe(true)

    const [mail, label] = mailCustomer.mock.calls[0]
    expect(mail.to).toBe('a@b.com')
    expect(label).toBe('job-delivered')
    expect(mail.subject).toContain('Callaita')
    // Belt-and-braces: no signed URL or storage path in the mail (song-job-email has its own guard).
    expect(mail.html).not.toContain('token=')
    expect(String(mail.text) + String(mail.html)).not.toContain('/deliveries/')
  })

  it('does nothing when the owner has no email', async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: null })
    const ok = await sendDeliveredEmail(JOB)
    expect(ok).toBe(false)
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})
