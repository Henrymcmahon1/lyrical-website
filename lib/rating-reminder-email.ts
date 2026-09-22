import { renderEmailHtml, renderEmailText, type EmailDoc } from './email-shell'
import { SITE_URL } from './site'

/**
 * `rating-reminder`: the ONE product email in v3's scope. Sent 24 to ~48 hours after delivery if
 * the track is still unrated, respects `profiles.product_emails` and `profiles.rating_reminders`,
 * and never more than once a day per person (`lib/email-log.ts`, `PRODUCT_EMAIL_SLUGS`).
 *
 * A gentle nudge, not a demand: the whole feedback loop (spec §1, "the feedback loop is the
 * product") depends on people actually rating tracks, and a pushy reminder is the fastest way to
 * make someone turn product emails off altogether.
 */

export type RatingReminderEmailFields = {
  title: string
}

function ratingReminderDoc(d: RatingReminderEmailFields): EmailDoc {
  return {
    preheader: `${d.title} is still waiting on your rating. It takes one tap.`,
    eyebrow: 'One tap',
    heading: `How did ${d.title} turn out?`,
    blocks: [
      {
        type: 'paragraph',
        text: `${d.title} has been in your studio for a day now, and we have not heard what you think of it.`,
      },
      {
        type: 'paragraph',
        text:
          'A thumbs up or down takes a moment, and a thumbs down unlocks a free re-roll so we ' +
          'can try again. Every rating also helps us learn what to get right next time.',
      },
      { type: 'cta', label: 'Rate your track', href: `${SITE_URL}/studio` },
      {
        type: 'note',
        text: 'You can turn these reminders off any time from your account page.',
      },
    ],
  }
}

export function ratingReminderSubject(d: RatingReminderEmailFields): string {
  return `lyrical: how did ${d.title} turn out?`
}

export function ratingReminderText(d: RatingReminderEmailFields): string {
  return renderEmailText(ratingReminderDoc(d))
}

export function ratingReminderHtml(d: RatingReminderEmailFields): string {
  return renderEmailHtml(ratingReminderDoc(d))
}
