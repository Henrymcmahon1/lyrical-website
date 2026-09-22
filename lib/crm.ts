import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Typed reads and writes for the `crm_*` tables (migration 005), plus the relationship columns
 * added to `enquiries` in the same migration.
 *
 * Service-role only, by construction: every function takes the admin client (or defaults to one),
 * never the customer's own session. `/admin` is the only caller, and it has already checked
 * `hasAdminSession()` before any of these run. Every write is zod-validated at the boundary, the
 * same discipline the rest of the codebase uses for customer input, applied here to staff input
 * because a note or a task title still ends up on a page and in a CSV.
 */
type Admin = ReturnType<typeof supabaseAdmin>

export type CrmNote = {
  id: string
  created_at: string
  author: string | null
  user_id: string | null
  enquiry_id: string | null
  body: string
}

export type CrmTask = {
  id: string
  created_at: string
  user_id: string | null
  enquiry_id: string | null
  title: string
  due_on: string | null
  owner: string | null
  done_at: string | null
}

const NoteInput = z
  .object({
    userId: z.string().uuid().optional(),
    enquiryId: z.string().uuid().optional(),
    author: z.string().trim().max(120).optional(),
    body: z.string().trim().min(1, 'A note needs some text').max(4000),
  })
  .refine((v) => Boolean(v.userId) !== Boolean(v.enquiryId) || (v.userId && v.enquiryId), {
    message: 'A note needs a user or an enquiry',
  })
  .refine((v) => Boolean(v.userId) || Boolean(v.enquiryId), {
    message: 'A note needs a user or an enquiry',
  })

export async function addNote(
  input: { userId?: string; enquiryId?: string; author?: string; body: string },
  admin: Admin = supabaseAdmin(),
): Promise<void> {
  const parsed = NoteInput.parse(input)
  const { error } = await admin.from('crm_notes').insert({
    user_id: parsed.userId ?? null,
    enquiry_id: parsed.enquiryId ?? null,
    author: parsed.author ?? null,
    body: parsed.body,
  })
  if (error) throw new Error(error.message)
}

export async function listNotes(
  args: { userId?: string; enquiryId?: string },
  admin: Admin = supabaseAdmin(),
): Promise<CrmNote[]> {
  let query = admin.from('crm_notes').select('*').order('created_at', { ascending: false })
  query = args.userId ? query.eq('user_id', args.userId) : query.eq('enquiry_id', args.enquiryId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as CrmNote[]
}

const TaskInput = z
  .object({
    userId: z.string().uuid().optional(),
    enquiryId: z.string().uuid().optional(),
    title: z.string().trim().min(1, 'A task needs a title').max(300),
    dueOn: z.string().trim().optional(),
    owner: z.string().trim().max(120).optional(),
  })
  .refine((v) => Boolean(v.userId) || Boolean(v.enquiryId), {
    message: 'A task needs a user or an enquiry',
  })

export async function addTask(
  input: { userId?: string; enquiryId?: string; title: string; dueOn?: string; owner?: string },
  admin: Admin = supabaseAdmin(),
): Promise<void> {
  const parsed = TaskInput.parse(input)
  const { error } = await admin.from('crm_tasks').insert({
    user_id: parsed.userId ?? null,
    enquiry_id: parsed.enquiryId ?? null,
    title: parsed.title,
    due_on: parsed.dueOn || null,
    owner: parsed.owner ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function listTasks(
  args: { userId?: string; enquiryId?: string; openOnly?: boolean },
  admin: Admin = supabaseAdmin(),
): Promise<CrmTask[]> {
  let query = admin.from('crm_tasks').select('*').order('due_on', { ascending: true })
  query = args.userId ? query.eq('user_id', args.userId) : query.eq('enquiry_id', args.enquiryId)
  if (args.openOnly) query = query.is('done_at', null)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as CrmTask[]
}

export async function completeTask(taskId: string, admin: Admin = supabaseAdmin()): Promise<void> {
  const { error } = await admin
    .from('crm_tasks')
    .update({ done_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw new Error(error.message)
}
