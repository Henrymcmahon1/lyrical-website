'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logIssue, setIssueStatus, type CrmIssueKind, type CrmIssueStatus } from '@/lib/crm'
import { hasAdminSession } from '@/lib/admin-session'

const ISSUE_KINDS: readonly CrmIssueKind[] = ['failed_job', 'refund', 'complaint', 'other']
const ISSUE_STATUSES: readonly CrmIssueStatus[] = ['open', 'ack', 'resolved']

function isIssueKind(value: string): value is CrmIssueKind {
  return (ISSUE_KINDS as readonly string[]).includes(value)
}

function isIssueStatus(value: string): value is CrmIssueStatus {
  return (ISSUE_STATUSES as readonly string[]).includes(value)
}

export async function createIssue(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/admin')

  const kind = String(formData.get('kind') ?? '')
  if (!isIssueKind(kind)) {
    revalidatePath('/admin')
    return
  }

  const jobId = String(formData.get('jobId') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  const detail = String(formData.get('detail') ?? '').trim()

  await logIssue({ jobId: jobId || undefined, userId: userId || undefined, kind, detail: detail || undefined })
  revalidatePath('/admin')
}

export async function changeIssueStatus(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/admin')

  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!id || !isIssueStatus(status)) {
    revalidatePath('/admin')
    return
  }

  await setIssueStatus(id, status)
  revalidatePath('/admin')
}
