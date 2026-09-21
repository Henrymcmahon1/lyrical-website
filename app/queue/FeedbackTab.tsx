import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Every rating, newest first. Staff path: the admin client, like the other tabs. The join to
 * song_jobs is a PostgREST embed over the job_id foreign key. No emails and no user ids in the
 * markup or the CSV: the note is the data, the job link is how you find the person.
 */
export type FeedbackRow = {
  id: string; created_at: string; job_id: string; rating: 'up' | 'down'; tags: string[]; note: string | null
  song_jobs: { title: string; primary_artist: string; source_language: string; target_language: string; reroll_index: number } | null
}
export const FEEDBACK_SELECT =
  'id, created_at, job_id, rating, tags, note, song_jobs(title, primary_artist, source_language, target_language, reroll_index)'
export const FEEDBACK_COLUMNS = ['created_at', 'title', 'primary_artist', 'source_language', 'target_language', 'reroll_index', 'rating', 'tags', 'note', 'job_id']
const PAGE_SIZE = 500
const mono = 'font-mono text-[11px] uppercase tracking-[0.16em]'

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

export async function FeedbackTab() {
  const { data, error } = await supabaseAdmin()
    .from('job_feedback').select(FEEDBACK_SELECT).order('created_at', { ascending: false }).limit(PAGE_SIZE)
  if (error) {
    return <p className="mt-12 max-w-xl text-graphite/70">The feedback table cannot be read. Apply migration 002 and reload. <span className="mt-3 block font-mono text-xs text-graphite/50">{error.message}</span></p>
  }
  const rows = (data ?? []) as unknown as FeedbackRow[]
  if (rows.length === 0) return <p className="mt-12 text-graphite/60">No ratings yet.</p>
  return (
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
          <a href={`/queue?tab=songs&show=all#${r.job_id}`} className="mt-3 inline-block text-sm text-indigo underline underline-offset-4">Open the job</a>
        </li>
      ))}
    </ol>
  )
}
