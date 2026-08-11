import { describe, it, expect } from 'vitest'
import {
  ALLOWED_MOVES,
  MOVES_THAT_EMAIL,
  OPEN_STATUSES,
  canMove,
  stampsFor,
  timeLeft,
} from '@/lib/job-transitions'
import { TURNAROUND_HOURS } from '@/lib/language-pairs'
import { JOB_STATUSES } from '@/lib/song-job-schema'

/**
 * The lifecycle graph, on its own, away from any database.
 *
 * `app/queue/actions.ts` proves the action consults this table. This proves the table says what
 * the business decided, which is a different question and the one that will be argued about
 * later.
 */

describe('the shape of the graph', () => {
  it('covers every status the schema defines', () => {
    // A status with no entry would throw at the button-drawing site rather than render nothing,
    // and it would be added by whoever adds the status, not by whoever finds the crash.
    for (const status of JOB_STATUSES) {
      expect(ALLOWED_MOVES[status]).toBeDefined()
    }
  })

  it('only ever moves to a real status', () => {
    for (const moves of Object.values(ALLOWED_MOVES)) {
      for (const to of moves) expect(JOB_STATUSES).toContain(to)
    }
  })

  it('never lets a job move to itself', () => {
    for (const [from, moves] of Object.entries(ALLOWED_MOVES)) {
      expect(moves).not.toContain(from)
    }
  })
})

describe('what may happen, and what may not', () => {
  it('accepts or refuses a new submission, and nothing else', () => {
    expect(canMove('submitted', 'approved')).toBe(true)
    expect(canMove('submitted', 'rejected')).toBe(true)
    expect(canMove('submitted', 'delivered')).toBe(false)
    expect(canMove('submitted', 'in_progress')).toBe(false)
  })

  it('lets a short job go straight from accepted to delivered', () => {
    // Clicking a step to describe a state the work was never in is ceremony, not process.
    expect(canMove('approved', 'delivered')).toBe(true)
  })

  it('REFUSES to reject anything already accepted', () => {
    /**
     * Accepting emails a delivery promise. Retracting that is a conversation somebody has, not
     * a button somebody clicks, and a button would get clicked.
     */
    expect(canMove('approved', 'rejected')).toBe(false)
    expect(canMove('in_progress', 'rejected')).toBe(false)
  })

  it('treats delivered and rejected as endings', () => {
    for (const to of JOB_STATUSES) {
      expect(canMove('delivered', to)).toBe(false)
      expect(canMove('rejected', to)).toBe(false)
    }
  })

  it('refuses a status that does not exist, in either position', () => {
    expect(canMove('submitted', 'cancelled')).toBe(false)
    expect(canMove('', 'approved')).toBe(false)
    expect(canMove('nonsense', 'approved')).toBe(false)
  })
})

describe('the timestamps', () => {
  const NOW = '2026-08-11T09:00:00.000Z'

  it('stamps approved_at on acceptance, because that is when the clock starts', () => {
    expect(stampsFor('approved', NOW)).toEqual({ approved_at: NOW })
  })

  it('stamps delivered_at on delivery', () => {
    expect(stampsFor('delivered', NOW)).toEqual({ delivered_at: NOW })
  })

  it('stamps nothing for the moves that carry no promise', () => {
    expect(stampsFor('in_progress', NOW)).toEqual({})
    expect(stampsFor('rejected', NOW)).toEqual({})
  })

  it('never clears a stamp, because the graph has no way back', () => {
    for (const status of JOB_STATUSES) {
      for (const value of Object.values(stampsFor(status, NOW))) {
        expect(value).toBe(NOW)
      }
    }
  })
})

describe('who gets told', () => {
  it('emails on acceptance and delivery only', () => {
    expect([...MOVES_THAT_EMAIL].sort()).toEqual(['approved', 'delivered'])
  })

  it('NEVER emails on rejection', () => {
    // Henry's decision, made with the trade-off in front of him. Written down here so that
    // adding one later has to be a deliberate act with a failing test in front of it.
    expect(MOVES_THAT_EMAIL).not.toContain('rejected')
  })
})

describe('the delivery clock', () => {
  const ACCEPTED = '2026-08-11T00:00:00.000Z'
  const at = (hoursAfter: number) => new Date(ACCEPTED).getTime() + hoursAfter * 3600_000

  it('counts down from acceptance, not from submission', () => {
    // The whole reason approved_at exists. A Friday evening submission must not burn a promise
    // while nobody is looking at it.
    expect(timeLeft(ACCEPTED, at(0)).text).toBe(`${TURNAROUND_HOURS}h left`)
    expect(timeLeft(ACCEPTED, at(12)).text).toBe(`${TURNAROUND_HOURS - 12}h left`)
  })

  it('does not cry wolf while there is plenty of time', () => {
    expect(timeLeft(ACCEPTED, at(1)).late).toBe(false)
  })

  it('warns while there is still time to act, not afterwards', () => {
    expect(timeLeft(ACCEPTED, at(TURNAROUND_HOURS - 5)).late).toBe(true)
  })

  it('says how far past the deadline it is, rather than a negative number', () => {
    const over = timeLeft(ACCEPTED, at(TURNAROUND_HOURS + 3))
    expect(over.text).toBe('3h over')
    expect(over.late).toBe(true)
    expect(over.text).not.toContain('-')
  })
})

describe('the default view', () => {
  it('shows exactly the statuses that still need a human', () => {
    expect([...OPEN_STATUSES].sort()).toEqual(['approved', 'in_progress', 'submitted'])
  })

  it('hides the two endings, so finished work cannot bury live work', () => {
    expect(OPEN_STATUSES).not.toContain('delivered')
    expect(OPEN_STATUSES).not.toContain('rejected')
  })
})
