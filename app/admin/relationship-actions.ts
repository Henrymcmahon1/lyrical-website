'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { addNote, addTask, RELATIONSHIP_STATUSES, setRelationshipStatus, type RelationshipStatus } from '@/lib/crm'
import { hasAdminSession } from '@/lib/admin-session'

/**
 * The Relationships tab's write actions: status/owner on an enquiry, plus the same note and
 * next-action pair the People tab has, scoped to an enquiry instead of a user. Kept separate
 * from `app/admin/people-actions.ts` even though the shape rhymes, because the two tabs' forms
 * post different hidden fields (`enquiryId` here, `userId` there) and mixing them invites a
 * mistaken id in the wrong field going unnoticed.
 */

function isRelationshipStatus(value: string): value is RelationshipStatus {
  return (RELATIONSHIP_STATUSES as readonly string[]).includes(value)
}

export async function updateRelationship(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/admin')

  const enquiryId = String(formData.get('enquiryId') ?? '')
  const status = String(formData.get('relStatus') ?? '')
  const owner = String(formData.get('relOwner') ?? '').trim()
  if (!enquiryId || !isRelationshipStatus(status)) {
    revalidatePath('/admin')
    return
  }

  await setRelationshipStatus(enquiryId, status, owner || undefined)
  revalidatePath('/admin')
}

export async function addRelationshipNote(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/admin')

  const enquiryId = String(formData.get('enquiryId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (!enquiryId || !body) {
    revalidatePath('/admin')
    return
  }

  await addNote({ enquiryId, body })
  revalidatePath('/admin')
}

export async function addRelationshipTask(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/admin')

  const enquiryId = String(formData.get('enquiryId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  if (!enquiryId || !title) {
    revalidatePath('/admin')
    return
  }

  const dueOn = String(formData.get('dueOn') ?? '').trim()
  await addTask({ enquiryId, title, dueOn: dueOn || undefined })
  revalidatePath('/admin')
}
