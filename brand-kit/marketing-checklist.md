# What a company at this stage still needs

Ordered by what unblocks the most. The website is live and works. Almost everything below
is cheap, and several items are blocking things that are not.

## Blocking, do these first

- [ ] **Run `supabase/schema.sql`.** Until the `enquiries` table exists the form returns a
      500 and no lead is stored. Nothing else on this list matters more.
- [ ] **A domain.** `lyrical-website.vercel.app` undercuts the credibility the rest of the
      site works for, and it blocks the two items below. Point it at Vercel and set
      `NEXT_PUBLIC_SITE_URL`.
- [ ] **A branded email address.** `hello@yourdomain` rather than a personal Gmail. A rights
      holder is being asked to trust you with masters.
- [ ] **Verify the domain in Resend.** Until then the sender can only deliver to the account
      owner, so no confirmation email can ever reach an enquirer.
- [ ] **One cleared before-and-after.** The whole claim is auditory and there is nothing to
      hear on the site. Highest-value item here, and the only one that cannot be faked.
      Commercial, not technical.

## Credibility

- [ ] **One named reference**, even a pilot, quoted and attributed. The trust argument is
      the one that cannot be made in your own voice.
- [ ] **Trademark search** before printing anything or filing. The spelling is settled:
      **Lyrical**, one L. Any older material spelling it *Lyricall* is out of date.
- [ ] **A one-page PDF leave-behind.** What it is, what you receive, how rights work, how to
      start. The most-requested asset after a first call.
- [ ] **A rights position one-pager** a lawyer can forward internally. Turns marketing copy
      into an asset that circulates inside the buyer's organisation without you in the room.
- [ ] **Verify the "$100 million in annual revenue" line** in Jordan's bio before it goes
      further. It is a specific, checkable claim about a third party on a credibility page.

## Commercial

- [ ] **Say something about price.** Even "we quote per release, most first releases start
      around X". A label currently has no idea whether this is a four or six figure
      decision, which pushes the enquiry to later and attracts the wrong ones.
- [ ] **Define the pilot.** "Send us one song" is the strongest line you have and it sits
      fourteen screens down. A named, bounded first step with a stated turnaround is a far
      easier internal sell for a label than an open conversation.
- [ ] **A reply-time promise.** "Answered within one working day" costs nothing and reduces
      the hesitation before somebody presses send.

## Operational

- [ ] **A shared inbox**, so enquiries do not sit in one person's Gmail.
- [ ] **A CRM, or a spreadsheet that behaves like one.** The Supabase table stores leads;
      nothing currently tracks what happened next.
- [ ] **Email signature.** `templates/email-signature.html` is ready to paste into Gmail.
- [ ] **Reply templates.** `templates/enquiry-replies.md` covers the first response, the
      examples request, and the no-for-now.
- [ ] **A deck.** Ten slides following the site's own order: the problem, permission, how it
      works, what you receive, the pilot, who we are.

## Measurement

- [x] **Analytics.** Vercel Web Analytics is live and cookieless, so it needs no consent
      banner.
- [ ] **Watch three numbers weekly:** visitors reaching the form, form starts, submissions.
      The gap between the last two is where the money is.
- [ ] **Give the demo request its own event** once audio exists, so you can see whether
      hearing it changes anything.

## Deliberately not on this list

- **A blog.** Nothing here is won on search volume, and an unmaintained blog reads worse
  than none at all.
- **Paid ads.** There is no proof asset and no stated price. Spending before either exists
  buys expensive bounces.
- **A second brand colour.** Four colours, four jobs. A fifth is how a system becomes a
  mood board.
