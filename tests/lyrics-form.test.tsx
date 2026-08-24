import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The lyrics field, actually rendered.
 *
 * `/studio/new` is behind a sign-in wall, so neither the responsive audit nor a browser session
 * can reach it from here: both would only ever see the login page. Rendering the component is
 * the one way to check that the field exists, accepts what it claims to, and says why it
 * matters, without a password.
 */

vi.mock('@/lib/supabase-client', () => ({ supabaseBrowser: () => ({}) }))
vi.mock('@/app/studio/submit-actions', () => ({ submitSongJob: vi.fn() }))

const { SongSubmitForm } = await import('@/components/SongSubmitForm')

const html = () => renderToStaticMarkup(<SongSubmitForm />)

describe('the field exists and asks for the right thing', () => {
  it('renders a lyrics area', () => {
    expect(html()).toContain('Lyrics')
  })

  it('accepts a .txt upload as well as a paste', () => {
    // Both routes in, which is what was asked for: some people have a file, some have it on
    // their clipboard, and the ones with a file should not have to open it first.
    expect(html()).toMatch(/accept="[^"]*\.txt[^"]*"/)
  })

  it('takes plain text/plain too, not only the extension', () => {
    // A file picked from a phone or a cloud drive may carry the MIME type and no extension.
    expect(html()).toContain('text/plain')
  })

  it('says WHY it helps rather than only labelling the box', () => {
    /**
     * Lyrics are optional, on Henry's decision, so persuasion is the only mechanism available.
     * A bare label gets skipped; a sentence explaining that the translation is built from it is
     * what makes somebody go and find the words.
     */
    expect(html()).toMatch(/translation is built from/i)
  })

  it('tells them they can add it later, so an empty box is not a dead end', () => {
    expect(html()).toMatch(/add it later/i)
  })

  it('sets dir="auto" so a right to left sheet is not rendered backwards', () => {
    // None of the eight languages is right to left today. The attribute costs nothing and
    // means the field is already correct if that changes.
    expect(html()).toContain('dir="auto"')
  })

  it('caps the paste at the same ceiling the schema enforces', () => {
    // Client and server agreeing matters here: a maxLength the server does not share would
    // silently truncate, and a server limit the field does not share rejects after the upload.
    expect(html()).toMatch(/maxlength="20000"/i)
  })
})

describe('what the field does not do', () => {
  it('does not mark lyrics required', () => {
    /**
     * Henry's decision: optional, pushed hard. The form already asks for an upload and a rights
     * warranty, and this is the primary conversion. Pinned because "just make it required" is
     * the obvious-looking change that would quietly cost submissions.
     */
    const lyricsArea = /<textarea[^>]*maxlength="20000"[^>]*>/i.exec(html())?.[0] ?? ''
    expect(lyricsArea).not.toMatch(/required/)
  })
})
