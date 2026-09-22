import { CONTACT_EMAIL } from '@/lib/enquiry-email'

/**
 * The copyright policy for Door 2 (self-serve).
 *
 * Henry's stance, handover `docs/HANDOVER-v3-2026-09-22.md` section H (22 Sep): a fan cannot
 * make a version of a commercial recording they do not own. This page is the public-facing
 * explanation of what that means in practice: what gets checked, why a submission can be
 * refused, how a rights holder reports a track, what happens to an account with repeated
 * matches, and how somebody wrongly blocked gets a human to look at it.
 *
 * Plain product wording, not counsel's text, the same category as `lib/terms.ts`
 * `LICENCE_TERMS_POINTS` (which links here). Indexed and linked from the footer/terms path
 * once that link lands, unlike `app/privacy/page.tsx`, which stays `noindex` until a lawyer has
 * reviewed it: nothing on this page is a legal representation on the company's behalf, only a
 * description of a product mechanism, so it does not carry the same review requirement.
 *
 * The exact numbers here (the confidence threshold, the repeat-offender count) are deliberately
 * NOT stated. Both are open decisions in `docs/bots/v3/copyright-research.md`, for Henry to set
 * once the ACRCloud trial exists and produces real match data; naming a number here before it is
 * decided would make this page wrong the day it ships.
 */
export const metadata = {
  title: 'Copyright policy',
  description:
    'What lyrical checks before a Door 2 track is made, and what happens when a submission matches a commercial recording.',
}

const EFFECTIVE = '22 September 2026'

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 font-brand text-2xl tracking-tight">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 leading-relaxed text-graphite/80">{children}</p>
}

export default function CopyrightPolicy() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-24 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">lyrical</span>
      <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight">Copyright policy</h1>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/45">
        Effective {EFFECTIVE}
      </p>

      <P>
        Door 2 is for your own songs, or songs you have the rights to. It is not a way to make a
        version of somebody else&rsquo;s commercial recording that you do not own and have not
        been given permission to use. This page explains how we check for that, what happens if a
        submission does not pass, and what to do if you think we got it wrong.
      </P>

      <H2>What we check, and why</H2>
      <P>
        When you submit a track, we run the audio you upload against a commercial music
        recognition service before any work begins. This looks for a match against recordings
        that are already commercially released, the same kind of check streaming platforms and
        broadcasters use. If a submission matches a commercial recording with enough confidence,
        we refuse it: the track is not made, no credit is used, and the submission is not queued.
      </P>
      <P>
        We check this because a fan cannot make a version of a recording they do not own, and
        because we would rather tell you that clearly at the moment you submit than after you
        have waited for a track that was never going to be delivered.
      </P>

      <H2>What this does and does not catch</H2>
      <P>
        This check looks at the actual audio you upload, not the song underneath it. If your
        upload contains, or is built from, a piece of an existing commercial recording, such as an
        instrumental lifted from a released track or a vocal stem taken from one, the check is
        likely to catch it. Performing your own cover of somebody else&rsquo;s song, in your own
        voice, with your own instrumental, is a different situation: the audio itself will
        usually not match anything in the database, which means this automatic check will not
        catch it. That does not mean it is automatically fine. You still need the rights to what
        you submit, which is exactly what the licence you agree to before submitting says.
      </P>

      <H2>Takedown requests</H2>
      <P>
        If you hold the rights to a recording and believe it has been used on lyrical without
        permission, tell us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>{' '}
        with enough detail to identify the track: the artist and title of your recording, a link
        or description of the version you believe was made from it, and how you can be reached.
        We look into every report, and where it is confirmed we take the delivered files down and
        remove access to them. We aim to respond quickly; if you have not heard back within a few
        business days, follow up on the same email.
      </P>

      <H2>Repeat submissions</H2>
      <P>
        An account with more than one confirmed match to a commercial recording is a pattern, not
        an accident, and we treat it that way: we may pause Door 2 access on that account while we
        look into it, and an account with a history of confirmed matches can lose Door 2 access
        altogether. This is separate from, and in addition to, refusing the individual submission
        at the time.
      </P>

      <H2>If you think a submission was wrongly refused</H2>
      <P>
        Automatic checks are not perfect. If your own song was refused because it happened to
        match something in the database, or you believe a match was wrong, email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>{' '}
        with what you submitted and when. A person looks at the specific result, not just the
        automatic answer, and can clear it so you can resubmit.
      </P>

      <H2>Changes to this policy</H2>
      <P>
        We may update this policy as the check itself changes. When we do, we will change the
        effective date at the top.
      </P>
    </section>
  )
}
