import { redirect } from 'next/navigation'
import { VoiceUploadForm } from '@/components/VoiceUploadForm'
import { currentUser } from '@/lib/supabase-server'
import { TRAINING_MINIMUM_SECONDS, TRAINING_TARGET_SECONDS } from '@/lib/voice-training'

/**
 * Add a voice model.
 *
 * Signed in only, same as the rest of the studio. The wall is a compromise argued in
 * `app/studio/new/page.tsx`: magic links lose form state across the email round trip, so the
 * account step has to come before somebody invests effort, not after.
 */
export const metadata = {
  title: 'Add a voice',
  robots: { index: false, follow: false },
}

const MINUTES_MIN = TRAINING_MINIMUM_SECONDS / 60
const MINUTES_TARGET = TRAINING_TARGET_SECONDS / 60

export default async function NewVoice() {
  const user = await currentUser()
  if (!user) redirect('/studio/sign-in?next=/studio/voices/new')

  return (
    <section className="mx-auto max-w-2xl px-6 py-20 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">The studio</span>

      <h1 className="mt-5 font-brand text-4xl leading-[1.08] tracking-tight text-balance">
        Teach us a voice.
      </h1>

      <p className="mt-6 leading-relaxed text-graphite/75">
        To sing in an artist&rsquo;s voice we first have to learn it, and that takes{' '}
        {MINUTES_MIN} to {MINUTES_TARGET} minutes of them singing on their own. You only do this
        once per artist. Every song you send us afterwards uses the same voice.
      </p>

      {/*
        What "clean" means, stated before the file picker rather than in a tooltip after it.
        The commonest failure is somebody uploading a full mix and waiting through it, and the
        cost of that is measured in their patience and in our storage.
      */}
      <div className="mt-10 rounded-card border-l-[3px] border-indigo bg-indigo/5 px-5 py-4">
        <p className="text-sm leading-relaxed text-graphite/80">
          <strong className="font-semibold text-graphite">Clean means the vocal alone.</strong>{' '}
          No instrumental underneath, no other singer, no bleed from the backing. Acapella
          stems, tracked vocals from the session, or anything your engineer can bounce solo.
          Dry is better than wet: heavy reverb or tuning gets learned as part of the voice.
        </p>
      </div>

      <div className="mt-12">
        <VoiceUploadForm />
      </div>
    </section>
  )
}
