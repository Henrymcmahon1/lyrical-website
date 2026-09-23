/**
 * What `/admin` and `/admin/sign-in` draw when a SIGNED-IN person is refused.
 *
 * Plain on purpose, in the admin look (cream, graphite, the brand serif), never the studio shell.
 * Neither offers a sign-out: a customer who wandered here keeps their studio session, and
 * nothing on this page touches it. No CRM data is ever rendered alongside these.
 */
const SHELL = 'mx-auto w-full max-w-4xl px-6'

export function NotAuthorized() {
  return (
    <section className={`${SHELL} py-24`}>
      <h1 className="font-brand text-4xl tracking-tight">Not authorized</h1>
      <p className="mt-4 max-w-md text-graphite/70">
        This account does not have access to the admin console.
      </p>
      <p className="mt-6">
        <a href="/studio" className="text-sm text-graphite/55 underline underline-offset-4">
          Go to the studio
        </a>
      </p>
    </section>
  )
}

/**
 * `ADMIN_REQUIRE_MFA=on` and this session has not verified a second factor (AAL2). The
 * enrolment and challenge screens are not built yet: this round only lays the switch.
 */
export function MfaRequired() {
  return (
    <section className={`${SHELL} py-24`}>
      <h1 className="font-brand text-4xl tracking-tight">Two-step verification required</h1>
      <p className="mt-4 max-w-md text-graphite/70">
        The admin console needs a verified authenticator code for this session. Ask Henry to
        finish setting up two-step verification for this account.
      </p>
    </section>
  )
}
