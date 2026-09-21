import { z } from 'zod'

/**
 * One rating per job per user. The database mirrors the note rule
 * (`job_feedback_down_needs_note`, 20 trimmed characters) so a forged request cannot save a
 * bare thumbs-down; this schema gives the customer a readable reason first.
 */
export const FEEDBACK_TAGS = ['timing', 'pronunciation', 'voice', 'meaning', 'mix', 'other'] as const
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number]
export const MIN_DOWN_NOTE_CHARS = 20
export const DOWN_NOTE_MESSAGE = 'Tell us what is wrong in at least 20 characters, so the re-roll can fix it.'

export const FeedbackSchema = z
  .object({
    jobId: z.string().regex(/^[0-9a-f-]{36}$/i),
    rating: z.enum(['up', 'down']),
    note: z.string().trim().max(4000).optional(),
    tags: z.array(z.enum(FEEDBACK_TAGS)).max(FEEDBACK_TAGS.length).default([]),
  })
  .refine((v) => v.rating !== 'down' || (v.note ?? '').length >= MIN_DOWN_NOTE_CHARS, {
    path: ['note'],
    message: DOWN_NOTE_MESSAGE,
  })
export type FeedbackInput = z.infer<typeof FeedbackSchema>
