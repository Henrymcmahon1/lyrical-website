import { beforeEach, describe, expect, it, vi } from 'vitest'
import { REFUSALS } from './admin-gate-fixtures'

/**
 * EVERY admin surface refuses a non-admin, before it reads or writes anything.
 *
 * One table of surfaces, three kinds of refusal each: nobody signed in, a signed-in customer
 * who is not on `ADMIN_EMAILS`, and an allowlisted user short of the required AAL. If a new
 * action or route is added under `app/admin` and not listed here, the export-count check at the
 * bottom fails, so a surface cannot quietly ship without a gate test.
 */

const requireAdmin = vi.fn()
vi.mock('@/lib/admin-session', () => ({ requireAdmin: () => requireAdmin() }))

// Any touch of the database, CRM helpers or mailer is a failure for a refused request.
const touched = vi.fn()
const spy =
  (name: string) =>
  (...a: unknown[]) => {
    touched(name, ...a)
    throw new Error(`${name} reached without an admin`)
  }

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: spy('from'),
    storage: { from: spy('storage.from') },
    auth: { admin: { getUserById: spy('getUserById') } },
  }),
}))
vi.mock('@/lib/crm', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm')>('@/lib/crm')
  return {
    ...actual,
    addNote: spy('addNote'),
    addTask: spy('addTask'),
    logIssue: spy('logIssue'),
    setIssueStatus: spy('setIssueStatus'),
    setRelationshipStatus: spy('setRelationshipStatus'),
  }
})
vi.mock('@/lib/mailer', () => ({ mailCustomer: spy('mailCustomer'), mailFounders: spy('mailFounders') }))

class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectError(to)
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: vi.fn(), get: vi.fn() }),
  headers: async () => new Headers(),
}))

const actions = await import('@/app/admin/actions')
const issueActions = await import('@/app/admin/issue-actions')
const peopleActions = await import('@/app/admin/people-actions')
const relationshipActions = await import('@/app/admin/relationship-actions')
const exportRoute = await import('@/app/admin/export/route')
const audioRoute = await import('@/app/admin/audio/route')
const door1Actions = await import('@/app/admin/door1/actions')
const door1Download = await import('@/app/admin/door1/download/route')

const UUID = '11111111-1111-4111-8111-111111111111'

function form(entries: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

/** A form that would pass every action's own validation, so only the gate can stop it. */
const FULL = form({
  id: UUID,
  from: 'rejected',
  to: 'approved',
  note: 'n',
  handled: 'true',
  kind: 'other',
  status: 'resolved',
  detail: 'd',
  userId: UUID,
  enquiryId: UUID,
  body: 'b',
  title: 't',
  relStatus: 'signed',
  relOwner: 'o',
})

const GATED_ACTIONS: Record<string, (fd: FormData) => Promise<unknown>> = {
  deleteLead: actions.deleteLead,
  setHandled: actions.setHandled,
  moveJob: actions.moveJob,
  saveNote: actions.saveNote,
  requeueJob: actions.requeueJob,
  moveVoice: actions.moveVoice,
  createIssue: issueActions.createIssue,
  changeIssueStatus: issueActions.changeIssueStatus,
  addPersonNote: peopleActions.addPersonNote,
  addPersonTask: peopleActions.addPersonTask,
  updateRelationship: relationshipActions.updateRelationship,
  addRelationshipNote: relationshipActions.addRelationshipNote,
  addRelationshipTask: relationshipActions.addRelationshipTask,
  createDoor1Job: door1Actions.createDoor1Job,
  door1UploadTicket: (fd) => door1Actions.door1UploadTicket(fd as never),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe.each(REFUSALS)('refused: %s', (_label, check) => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue(check)
  })

  for (const [name, action] of Object.entries(GATED_ACTIONS)) {
    it(`server action ${name} redirects away and touches nothing`, async () => {
      await expect(action(FULL)).rejects.toThrow('REDIRECT:/admin')
      expect(requireAdmin).toHaveBeenCalledTimes(1)
      expect(touched).not.toHaveBeenCalled()
    })
  }

  it('GET /admin/export is a 404 and reads nothing', async () => {
    for (const tab of ['work', 'relationships', 'voice', 'voices', 'feedback']) {
      const res = await exportRoute.GET(new Request(`https://x.test/admin/export?tab=${tab}`))
      expect(res.status).toBe(404)
    }
    expect(touched).not.toHaveBeenCalled()
  })

  it('GET /admin/audio is a 404 and signs nothing', async () => {
    for (const q of [`asset=${UUID}`, `voice=${UUID}`]) {
      const res = await audioRoute.GET(new Request(`https://x.test/admin/audio?${q}`))
      expect(res.status).toBe(404)
    }
    expect(touched).not.toHaveBeenCalled()
  })

  it('GET /admin/door1/download is a 404 and signs nothing', async () => {
    const res = await door1Download.GET(new Request(`https://x.test/admin/door1/download?delivery=${UUID}`))
    expect(res.status).toBe(404)
    expect(touched).not.toHaveBeenCalled()
  })
})

describe('coverage', () => {
  it('lists every gated server action exported from app/admin', () => {
    // login and logout are the only ungated exports: login is the break-glass entry point
    // (tested separately) and logout only clears the caller's own session.
    const exported = [actions, issueActions, peopleActions, relationshipActions, door1Actions]
      .flatMap((m) => Object.keys(m))
      .filter((k) => k !== 'login' && k !== 'logout')
      .sort()
    expect(exported).toEqual(Object.keys(GATED_ACTIONS).sort())
  })
})
