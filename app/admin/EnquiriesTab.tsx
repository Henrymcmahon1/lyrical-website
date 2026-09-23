import { listNotes, listTasks, RELATIONSHIP_STATUSES, type CrmNote, type CrmTask, type RelationshipStatus } from '@/lib/crm'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { deleteLead, setHandled } from './actions'
import { addRelationshipNote, addRelationshipTask, updateRelationship } from './relationship-actions'

/**
 * The Relationships tab: the enquiry inbox (moved here from `/leads` when the console gained a
 * second tab), plus artist EOIs (`source = 'artist_eoi'`, same table), now with a relationship
 * status and owner, and staff notes/next actions the same shape as the People tab has.
 *
 * The enquiry-reading half was moved rather than rewritten. That code worked, it was tested, and
 * its CSV export defuses spreadsheet formula injection.
 */

const RELATIONSHIP_LABEL: Record<RelationshipStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  in_talks: 'In talks',
  signed: 'Signed',
  closed: 'Closed',
}

/**
 * How many enquiries one page shows.
 *
 * There is no pagination yet, so this is a ceiling rather than a page size. It is only safe
 * because the page says when it has hit it. If that message ever disappears, this cap becomes
 * silent data loss from the operator's point of view.
 */
const PAGE_SIZE = 500

/**
 * Readable form of the catalog-size answer.
 *
 * The raw values are form option keys, so rendering `${value} songs` produced "unsure songs",
 * which reads as though somebody is unsure what a song is.
 */
const CATALOGUE_LABEL: Record<string, string> = {
  '1': 'One song',
  '2-10': '2 to 10 songs',
  '11-100': '11 to 100 songs',
  '100+': '100+ songs',
  unsure: 'Size not known',
}

export async function EnquiriesTab({
  showAll,
  confirming,
  deleted,
}: {
  showAll: boolean
  confirming?: string
  deleted?: boolean
}) {
  /**
   * `count: 'exact'` counts every matching row, not just the page returned.
   *
   * Without it the cap below is invisible: at 501 enquiries the oldest simply stopped
   * appearing and nothing said so, which is the kind of thing you find out at the worst
   * possible moment.
   */
  let query = supabaseAdmin()
    .from('enquiries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (!showAll) query = query.eq('handled', false)

  const { data, error, count } = await query

  if (error) {
    return (
      <p className="mt-12 max-w-xl text-graphite/70">
        The enquiries table cannot be read yet. Apply{' '}
        <code className="font-mono text-sm">supabase/migrations</code> to the
        database and reload.
        <span className="mt-3 block font-mono text-xs text-graphite/50">
          {`${error.code ?? ''} ${error.message}`.trim()}
        </span>
      </p>
    )
  }

  const leads = data ?? []
  const total = count ?? leads.length
  const truncated = total > leads.length

  const base = `/admin?tab=relationships${showAll ? '&show=all' : ''}`

  /** Notes and open next actions per enquiry, fetched once each rather than per row. */
  const admin = supabaseAdmin()
  const notesAndTasks = await Promise.all(
    leads.map(async (l) => {
      const [notes, tasks] = await Promise.all([
        listNotes({ enquiryId: l.id }, admin).catch((): CrmNote[] => []),
        listTasks({ enquiryId: l.id, openOnly: true }, admin).catch((): CrmTask[] => []),
      ])
      return [l.id, { notes, tasks }] as const
    }),
  )
  const extrasById = new Map(notesAndTasks)

  return (
    <>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/45 tabular-nums">
        {truncated
          ? `Newest ${leads.length} of ${total}`
          : `${total} ${total === 1 ? 'enquiry' : 'enquiries'}`}
      </p>

      {deleted && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Enquiry deleted.
        </p>
      )}

      {leads.length === 0 ? (
        <p className="mt-12 text-graphite/60">
          {showAll
            ? 'Nothing has come through yet.'
            : 'Nothing waiting. Every enquiry has been handled.'}
        </p>
      ) : (
        <ol className="mt-2">
          {leads.map((l) => (
            <li key={l.id} id={`enquiry-${l.id}`} className="scroll-mt-6 border-b border-graphite/12 py-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-brand text-2xl tracking-tight">{l.name}</h3>
                <a
                  href={`mailto:${l.email}`}
                  className="text-indigo underline underline-offset-4"
                >
                  {l.email}
                </a>
                {l.handled && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite/40">
                    Handled
                  </span>
                )}
                <time
                  dateTime={l.created_at}
                  className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45"
                >
                  {new Date(l.created_at).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
                <div className="flex gap-2">
                  <dt className="sr-only">Role</dt>
                  <dd>{l.role}</dd>
                </div>
                {l.company && (
                  <div className="flex gap-2">
                    <dt className="sr-only">Company</dt>
                    <dd>{l.company}</dd>
                  </div>
                )}
                {l.catalogue_size && (
                  <div className="flex gap-2">
                    <dt className="sr-only">Catalog</dt>
                    <dd>{CATALOGUE_LABEL[l.catalogue_size] ?? l.catalogue_size}</dd>
                  </div>
                )}
                {l.target_languages?.length ? (
                  <div className="flex gap-2">
                    <dt className="sr-only">Languages</dt>
                    <dd>{l.target_languages.join(', ')}</dd>
                  </div>
                ) : null}
                {l.source === 'gate' && (
                  <div className="flex gap-2">
                    <dt className="sr-only">Source</dt>
                    <dd className="text-ember">Asked for examples</dd>
                  </div>
                )}
              </dl>

              {l.message && (
                <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-graphite/80">
                  {l.message}
                </p>
              )}

              {/* Relationship status and owner. A select and a text field, one form, one save. */}
              <form action={updateRelationship} className="mt-5 flex flex-wrap items-center gap-3">
                <input type="hidden" name="enquiryId" value={l.id} />
                <select
                  name="relStatus"
                  defaultValue={l.rel_status ?? 'new'}
                  className="min-h-11 rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
                >
                  {RELATIONSHIP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {RELATIONSHIP_LABEL[s]}
                    </option>
                  ))}
                </select>
                <input
                  name="relOwner"
                  type="text"
                  defaultValue={l.rel_owner ?? ''}
                  placeholder="Owner"
                  className="min-h-11 w-40 rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
                />
                <button
                  type="submit"
                  className="min-h-11 rounded-card border border-graphite/25 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
                >
                  Save
                </button>
              </form>

              {(() => {
                const extras = extrasById.get(l.id)
                if (!extras) return null
                return (
                  <>
                    {extras.tasks.length > 0 && (
                      <ul className="mt-4 flex flex-col gap-1.5">
                        {extras.tasks.map((t) => (
                          <li key={t.id} className="text-sm text-ember">
                            Next: {t.title}
                            {t.due_on ? ` (due ${t.due_on})` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    {extras.notes.length > 0 && (
                      <ul className="mt-4 flex flex-col gap-2">
                        {extras.notes.map((n) => (
                          <li key={n.id} className="text-sm text-graphite/80">
                            {n.body}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )
              })()}

              <div className="mt-5 flex flex-wrap gap-6">
                <form action={addRelationshipNote} className="flex flex-wrap items-start gap-3">
                  <input type="hidden" name="enquiryId" value={l.id} />
                  <textarea
                    name="body"
                    rows={2}
                    placeholder="Add a note"
                    className="min-h-11 w-full max-w-xs rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
                  />
                  <button
                    type="submit"
                    className="min-h-11 rounded-card border border-graphite/25 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
                  >
                    Save note
                  </button>
                </form>

                <form action={addRelationshipTask} className="flex flex-wrap items-start gap-3">
                  <input type="hidden" name="enquiryId" value={l.id} />
                  <input
                    name="title"
                    type="text"
                    placeholder="Next action"
                    className="min-h-11 w-full max-w-xs rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
                  />
                  <input
                    name="dueOn"
                    type="date"
                    className="min-h-11 rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
                  />
                  <button
                    type="submit"
                    className="min-h-11 rounded-card border border-graphite/25 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
                  >
                    Add task
                  </button>
                </form>
              </div>

              {/*
                Confirm as a page state, not a browser dialog.

                `confirm()` would not exist with JavaScript disabled, and this deletion cannot
                be undone. A link into a confirm state and a second, explicit submit works
                everywhere and makes the destructive step deliberate. The real guard is the
                session check inside the action; this only stops an accidental click.
              */}
              {confirming === l.id ? (
                <div className="mt-4 rounded-card border border-ember/40 p-4">
                  <p className="text-sm text-graphite">
                    Delete this enquiry permanently? This cannot be undone, and it removes
                    what {l.name} wrote as well as their contact details.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <form action={deleteLead}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="show" value={showAll ? 'all' : ''} />
                      <button
                        type="submit"
                        className="inline-flex min-h-11 items-center rounded-card bg-ember px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-cream"
                      >
                        Yes, delete it
                      </button>
                    </form>
                    <a
                      href={base}
                      className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/55 underline underline-offset-4 hover:text-indigo"
                    >
                      Cancel
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <form action={setHandled}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="handled" value={String(!l.handled)} />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center rounded-card border border-graphite/25 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
                    >
                      {l.handled ? 'Move back to handle' : 'Mark handled'}
                    </button>
                  </form>
                  <a
                    href={`${base}&confirm=${l.id}`}
                    className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/40 underline underline-offset-4 hover:text-ember"
                  >
                    Delete
                  </a>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
