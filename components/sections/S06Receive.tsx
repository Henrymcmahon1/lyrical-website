import { PinnedStepper, type Step } from '../PinnedStepper'

const ITEMS: Step[] = [
  { h: 'A finished mix', p: 'Matched to the original record’s vocal balance.' },
  { h: 'A dry vocal stem', p: 'Unprocessed, for your own engineer.' },
  { h: 'Reference versions', p: 'For A/B against the original.' },
  { h: 'A per-song report', p: 'What was covered, what was left original, and where.' },
]

export default function S06Receive() {
  return (
    <section>
      <PinnedStepper
        eyebrow="What you receive"
        title="Studio ready, and yours to mix."
        intro="You keep creative and mixing control. We hand over stems, not a locked file."
        steps={ITEMS}
        numbered={false}
        carousel
      />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex flex-wrap gap-x-10 gap-y-3 font-mono text-xs tracking-[0.14em] text-graphite/50 tabular-nums">
          <span>48.0 kHz</span>
          <span>24 bit</span>
          <span>08 languages</span>
          <span>Reviewed by ear</span>
        </div>
      </div>
    </section>
  )
}
