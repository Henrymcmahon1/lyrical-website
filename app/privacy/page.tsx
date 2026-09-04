import { CONTACT_EMAIL } from '@/lib/enquiry-email'

/**
 * The privacy policy.
 *
 * A first draft, accurate to the data the site actually handles and the processors it actually
 * uses, written for counsel to review before it is relied upon. It is `noindex` and is not linked
 * from the footer or the sitemap yet: once a lawyer has signed off, flip `robots` to index it and
 * add the footer link.
 *
 * The RB2B block is that vendor's own recommended wording, reproduced verbatim, including both
 * opt-out URLs. Do not paraphrase it. The legal entity `Lyrical Global Technologies, Inc.` is the
 * documented exception to the lowercase brand, the same as in `lib/terms.ts`.
 */
export const metadata = {
  title: 'Privacy',
  robots: { index: false, follow: false },
}

const EFFECTIVE = '31 August 2026'

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 font-brand text-2xl tracking-tight">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 leading-relaxed text-graphite/80">{children}</p>
}

export default function Privacy() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-24 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">lyrical</span>
      <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight">Privacy policy</h1>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/45">
        Effective {EFFECTIVE}
      </p>

      <P>
        This policy explains what personal information lyrical, operated by Lyrical Global
        Technologies, Inc. (the &ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;),
        collects when you use this website, how we use it, who we share it with, and the choices you
        have. If you have any questions, contact us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        .
      </P>

      <H2>Information you give us</H2>
      <P>
        When you contact us or use the studio, we collect the information you provide. This includes
        the details on the enquiry form, such as your name, email address, role, company, catalog
        size, the languages you are interested in, and your message. If you sign in to the studio,
        we collect the email address you use to receive a sign-in link. When you submit a song or
        build a voice model, we collect the recordings, lyrics, and artist names you upload, along
        with the rights warranties and consents you agree to and the time you agreed to them.
      </P>

      <H2>Information collected automatically</H2>
      <P>
        When you visit the site, we and our service providers automatically collect certain
        technical information, which may include your IP address, browser and device type, the
        pages you view, and the site that referred you. We use Vercel Web Analytics, which is
        cookieless and does not use your IP address to track you across sites, to understand
        aggregate traffic. We also use the visitor identification service described below.
      </P>

      <H2>Visitor identification and advertising</H2>
      <P>
        We use a third-party service to help us identify business visitors to our site for sales
        and marketing. As that provider recommends, we disclose the following:
      </P>
      <div className="mt-4 rounded-card border-l-[3px] border-indigo bg-indigo/5 px-5 py-4 text-sm leading-relaxed text-graphite/80">
        <p>
          When you visit or log in to our website, cookies and similar technologies may be used by
          our online data partners or vendors to associate these activities with other personal
          information they or others have about you, including by association with your email. We
          (or service providers on our behalf) may then send communications and marketing to these
          email addresses. You may opt out of receiving this advertising by visiting{' '}
          <a
            href="https://app.retention.com/optout"
            target="_blank"
            rel="noreferrer"
            className="text-indigo underline underline-offset-4"
          >
            https://app.retention.com/optout
          </a>
          .
        </p>
        <p className="mt-3">
          You also have the option to opt out of the collection of your personal data in compliance
          with GDPR by visiting{' '}
          <a
            href="https://www.rb2b.com/rb2b-gdpr-opt-out"
            target="_blank"
            rel="noreferrer"
            className="text-indigo underline underline-offset-4"
          >
            https://www.rb2b.com/rb2b-gdpr-opt-out
          </a>
          .
        </p>
      </div>

      <H2>Cookies and similar technologies</H2>
      <P>
        A necessary cookie is set when you sign in to the studio, so that your session is
        remembered. Our bot-protection provider may set a cookie to tell humans from automated
        traffic. The visitor identification service described above uses cookies and similar
        technologies. Our analytics are cookieless. You can control cookies through your browser
        settings, though blocking the necessary cookie will prevent you from signing in.
      </P>

      <H2>How we use your information</H2>
      <P>
        We use the information we collect to respond to your enquiries, to provide and deliver the
        service you ask for, to communicate with you about your submissions, for sales and
        marketing, to keep the site secure and prevent abuse, to understand how the site is used,
        and to meet our legal obligations.
      </P>

      <H2>Service providers we share information with</H2>
      <P>
        We share personal information with the service providers that run the site on our behalf,
        under agreements that limit their use of it: Vercel, which hosts the site and provides
        analytics; Supabase, which stores our database and uploaded files; Resend, which sends our
        email; Zoho, which receives email to our address; Cloudflare, which provides bot
        protection; and RB2B (Retention.com), which provides the visitor identification described
        above. We may also disclose information where required by law, or to protect our rights and
        the safety of others.
      </P>

      <H2>How long we keep it</H2>
      <P>
        We keep personal information for as long as needed to provide the service and for our
        legitimate business and legal purposes. Recordings and materials you submit are kept for as
        long as your account and the related work require, and are deleted when they are no longer
        needed. You can ask us to delete your information using the contact details below.
      </P>

      <H2>Where your information is processed</H2>
      <P>
        We are based in the United States and our service providers process information there. If
        you access the site from outside the United States, you understand that your information may
        be transferred to and processed in the United States, where data protection laws may differ
        from those in your country.
      </P>

      <H2>Your rights and choices</H2>
      <P>
        Depending on where you live, you may have the right to access, correct, delete, or receive a
        copy of your personal information, to object to or restrict certain processing, and to
        withdraw consent. If you are in the European Economic Area or the United Kingdom, or a
        resident of California, you may have additional rights under the GDPR or the California
        Consumer Privacy Act, including the right to opt out of the sharing of your personal
        information for cross-context advertising. To exercise any of these rights, email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        , or use the opt-out links in the visitor identification section above. We will not
        discriminate against you for exercising your rights.
      </P>

      <H2>Children</H2>
      <P>
        The site is not directed to children, and we do not knowingly collect personal information
        from anyone under 16. If you believe a child has provided us information, contact us and we
        will delete it.
      </P>

      <H2>Changes to this policy</H2>
      <P>
        We may update this policy from time to time. When we do, we will change the effective date
        at the top, and significant changes will be made clear on this page.
      </P>

      <H2>Contact us</H2>
      <P>
        Lyrical Global Technologies, Inc. You can reach us about privacy at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        .
      </P>
    </section>
  )
}
