'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { addNote, addTask } from '@/lib/crm'
import { hasAdminSession } from '@/lib/admin-session'

/**
 * The People tab's two write actions: a note and a next action (task), both keyed to one
 * account. Kept separate from `app/admin/actions.ts` so that file does not grow to cover every
 * tab; Relationships (Task 5) gets its own equivalent pair for enquiries.
 *
 * Every action re-checks `hasAdminSession()`, the same discipline the rest of `/admin` uses:
 * a server action is a POST endpoint a form post can reach without ever having rendered the page.
 */

export async function addPersonNote(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/admin')

  const userId = String(formData.get('userId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (!userId || !body) {
    revalidatePath('/admin')
    return
  }

  await addNote({ userId, body })
  revalidatePath('/admin')
}

export async function addPersonTask(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/admin')

  const userId = String(formData.get('userId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  if (!userId || !title) {
    revalidatePath('/admin')
    return
  }

  const dueOn = String(formData.get('dueOn') ?? '').trim()
  await addTask({ userId, title, dueOn: dueOn || undefined })
  revalidatePath('/admin')
}
