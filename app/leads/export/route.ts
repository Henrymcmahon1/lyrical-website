import { permanentRedirect } from 'next/navigation'

/**
 * The old CSV endpoint, now served by `/queue/export`.
 *
 * A redirect rather than a copy, so there is exactly one implementation of the export and one
 * place where the formula-injection defusing lives.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  permanentRedirect('/queue/export?tab=enquiries')
}
