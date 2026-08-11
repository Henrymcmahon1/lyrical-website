import { renderEmailHtml, renderEmailText, type EmailDoc } from './email-shell'
import { SITE_URL } from './site'

/**
 * The one email an ACCOUNT sends, as opposed to a song.
 *
 * Its own file rather than a fifth function in `song-job-email.ts`, because it is triggered by
 * a different thing and says a different thing. A song email is about an object somebody
 * handed us; this one is about a door being opened, and its entire job is to get the first
 * song through it.
 *
 * ## When it fires, and why that is not obvious
 *
 * Sign-in is a magic link, so "created an account" and "signed in for the first time" are the
 * same click. There is no separate signup event to hook. `app/auth/callback/route.ts` settles
 * it by inserting the profile row with `ignoreDuplicates`: a returned row means the row did not
 * exist a moment ago, which means this is the first time this person has ever landed here.
 * That check is atomic in the database rather than a read followed by a write, so two links
 * opened at once cannot produce two welcomes.
 *
 * ## What it must not say
 *
 * No royalty model, no pricing beyond "no upfront cost", and no speed claim other than the 48
 * hours, which counts from acceptance. Those are locked decisions and this email is the first
 * thing a new customer reads, so it is the easiest place to break one by accident.
 */

export function welcomeSubject(): string {
  return 'lyrical: your studio is open'
}

function welcomeDoc(): EmailDoc {
  return {
    preheader: 'Send us one song and hear it in another language, at no upfront cost.',
    eyebrow: 'Welcome',
    heading: 'Your studio is open.',
    blocks: [
      {
        type: 'paragraph',
        text:
          'You can send us a song whenever you are ready. One is enough to see what this ' +
          'sounds like, and most people start with the one they already wish travelled ' +
          'further.',
      },
      {
        type: 'rows',
        rows: [
          ['1', 'Send the stems, or a full mix if that is what you have'],
          ['2', 'We confirm we can take it on, and the clock starts there'],
          ['3', 'You hear it before anyone else, and sign only if you want it released'],
        ],
      },
      { type: 'cta', label: 'Send your first song', href: `${SITE_URL}/studio/new` },
      {
        type: 'paragraph',
        text:
          'There is no upfront cost, and nothing is released without your approval. Your ' +
          'recording is never used to build anything without your say so.',
      },
      {
        type: 'note',
        text:
          'Everything you upload sits in private storage that only you and we can reach. We ' +
          'never link to it in email, which is why this message does not.',
      },
    ],
  }
}

export function welcomeText(): string {
  return renderEmailText(welcomeDoc())
}

export function welcomeHtml(): string {
  return renderEmailHtml(welcomeDoc())
}
