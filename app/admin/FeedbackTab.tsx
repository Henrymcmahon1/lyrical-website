import type { Tables } from '@/lib/db/database.types'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Every rating, newest first, filterable by tag and by rating. Staff path: the admin client,
 * like the other tabs. The join to song_jobs is a PostgREST embed over the job_id foreign key.
 * No emails and no user ids in the markup or the CSV: the note is the data, the job link is how
 * you find the person.
 */
export type FeedbackRow = Pick<Tables<'job_feedback'>, 'id' | 'created_at' | 'job_id' | 'rating' | 'tags' | 'note'> & {
  song_jobs: Pick<Tables<'song_jobs'>, 'title' | 'primary_artist' | 'source_language' | 'target_language' | 'reroll_index'> | null
}
export const FEEDBACK_SELECT =
  'id, created_at, job_id, rating, tags, note, song_jobs(title, primary_artist, source_language, target_language, reroll_index)'
export const FEEDBACK_COLUMNS = ['created_at', 'title', 'primary_artist', 'source_language', 'target_language', 'reroll_index', 'rating', 'tags', 'note', 'job_id']
const PAGE_SIZE = 500
const mono = 'font-mono text-[11px] uppercase tracking-[0.16em]'

/** The tag chips offered at submit (`components/FeedbackBar.tsx`), repeated here for filtering. */
export const FEEDBACK_TAGS = ['timing', 'pronunciation', 'voice', 'meaning', 'mix', 'other'] as const

export function flattenFeedback(rows: FeedbackRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    created_at: r.created_at,
    title: r.song_jobs?.title ?? '',
    primary_artist: r.song_jobs?.primary_artist ?? '',
    source_language: r.song_jobs?.source_language ?? '',
    target_language: r.song_jobs?.target_language ?? '',
    reroll_index: r.song_jobs?.reroll_index ?? 0,
    rating: r.rating,
    tags: r.tags,
    note: r.note,
    job_id: r.job_id,
  }))
}

export async function FeedbackTab({
  tag,
  rating,
}: {
  tag?: string
  rating?: 'up' | 'down'
} = {}) {
  let query = supabaseAdmin()
    .from('job_feedback')
    .select(FEEDBACK_SELECT)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (rating) query = query.eq('rating', rating)
  if (tag) query = query.contains('tags', [tag])

  const { data, error } = await query
  if (error) {
    return <p className="mt-12 max-w-xl text-graphite/70">The feedback table cannot be read. Apply migration 002 and reload. <span className="mt-3 block font-mono text-xs text-graphite/50">{error.message}</span></p>
  }
  const rows: FeedbackRow[] = data ?? []

  const base = '/admin?tab=voice'
  const ratingHref = (r?: 'up' | 'down') => `${base}${r ? `&rating=${r}` : ''}${tag ? `&tag=${tag}` : ''}`
  const tagHref = (t?: string) => `${base}${rating ? `&rating=${rating}` : ''}${t ? `&tag=${t}` : ''}`

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.16em]">
        <a href={ratingHref(undefined)} className={rating ? 'text-graphite/45 hover:text-indigo' : 'text-indigo'}>
          All ratings
        </a>
        <a href={ratingHref('up')} className={rating === 'up' ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'}>
          Thumbs up
        </a>
        <a href={ratingHref('down')} className={rating === 'down' ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'}>
          Thumbs down
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/45">
        <a href={tagHref(undefined)} className={tag ? 'hover:text-indigo' : 'text-indigo'}>
          all tags
        </a>
        {FEEDBACK_TAGS.map((t) => (
          <a key={t} href={tagHref(t)} className={tag === t ? 'text-indigo' : 'hover:text-indigo'}>
            {t}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-12 text-graphite/60">
          {rating || tag ? 'No ratings match that filter.' : 'No ratings yet.'}
        </p>
      ) : (
        <ol className="mt-2">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-graphite/12 py-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-brand text-2xl tracking-tight">{r.song_jobs?.title ?? 'Unknown song'}</h3>
                <span className="text-sm text-graphite/60">
                  {r.song_jobs?.primary_artist} &middot; {r.song_jobs?.source_language} to {r.song_jobs?.target_language}
                  {r.song_jobs?.reroll_index ? ` · Take ${r.song_jobs.reroll_index + 1}` : ''}
                </span>
                <span className={`${mono} ${r.rating === 'down' ? 'text-ember' : 'text-indigo'}`}>{r.rating === 'down' ? 'Thumbs down' : 'Thumbs up'}</span>
                <time dateTime={r.created_at} className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45">
                  {new Date(r.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              {r.tags.length > 0 && <p className={`mt-2 ${mono} text-graphite/50`}>{r.tags.join(' · ')}</p>}
              {r.note && <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-graphite/80">{r.note}</p>}
              <a href={`/admin?tab=work&show=all#${r.job_id}`} className="mt-3 inline-block text-sm text-indigo underline underline-offset-4">Open the job</a>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
