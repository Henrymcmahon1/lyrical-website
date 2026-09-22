import { permanentRedirect } from 'next/navigation'

/**
 * `/leads` became the Enquiries tab of `/queue` on 2026-08-11, which became the Relationships
 * tab of `/admin` on 2026-09-22. Points straight at `/admin` rather than chaining through the
 * now-also-a-redirect `/queue`, so this is one hop, not two.
 *
 * Kept as a redirect rather than deleted, because this URL is in two people's bookmarks and in
 * the muscle memory of the only two people who use it. A 404 here on a Monday morning reads as
 * "the leads are gone".
 *
 * `permanentRedirect` is a 308, which preserves the method. It is safe here because nothing
 * ever POSTed to this page: the form actions have always had their own endpoints.
 */
export default function LeadsRedirect() {
  permanentRedirect('/admin?tab=relationships')
}
