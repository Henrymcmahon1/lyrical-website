/**
 * The finished cover, playable in the studio.
 *
 * A native `<audio controls>` on purpose: it works with JavaScript disabled, needs no player
 * library, and streams from `/studio/audio`, which signs a short-lived URL per play after the
 * ownership check. The element holds only a delivery id in its src, never a signed URL, so the
 * markup carries nothing that would work if it escaped the page.
 */
export function DeliveryPlayer({ deliveryId }: { deliveryId: string }) {
  return (
    <div className="mt-6">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Your cover</span>
      <audio
        controls
        preload="none"
        className="mt-3 w-full"
        src={`/studio/audio?delivery=${deliveryId}`}
      >
        Your browser cannot play this file. It is ready in your studio whenever you can.
      </audio>
    </div>
  )
}
