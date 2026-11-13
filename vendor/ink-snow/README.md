# InkSnow 1.3.5 runtime

These files originate from the user-provided
`ink-snow-svelte-scroll-v1.3.5.zip`, under `ink-snow-svelte/src/lib/`.
The source archive SHA-256 is `fa6cc9f75b37f4b73a4630197f82587444e88e1b50c76aef98a0938487512891`.

The engine has local scroll and recycling patches. The optional mount setting
`scrollFrameRate: 'capture'` makes scroll redraws follow the configured `fps`.
It keeps collecting camera and cloud movement on every animation frame, then
shows the accumulated movement on the next capture. The default remains
display-rate scroll reprojection, including when no `fps` limit is set. The
option is also declared in `engine.d.ts`.

`scrollFrameRate: 'buffered'` with `aspectMode: 'auto'` retains the capture cadence
and renders 128 logical pixels above and below the viewport. Snow, watercolor,
paper, and film effects cover this buffer. The logical viewport, camera center, particle count, and
existing birth reservoir are unchanged; backing-store and density-field pixel
budgets include the extra area. The canvas gets an inline CSS height and top
offset matching the buffer, so its stage must retain the viewport height and
allow overflow. A snapshot includes the buffer.

The `onPresent({ scrollTop, padding, paused })` callback runs synchronously after
the new bitmap is displayed. `scrollTop` is the actual scroll-container position
sampled for that bitmap, and `padding` is the buffer size on each side in CSS
pixels. An integration can anchor a native sticky scroll layer to that position
and clip its travel to the padding until the next capture. The scroll layer can
then move without a JavaScript scroll handler or another density composition.
Keep it fixed only when `padding === 0`. Paused buffered scenes retain native
scroll transport: scroll input replenishes the reserve at the configured capture
rate without advancing simulation time, layer samples, or the held exposure.
Idle paused scenes do not schedule a continuous animation loop. Both pause and
resume absorb pending native movement before reanchoring the photograph.

Buffered camera movement is a uniform 1:1 screen-space pan for the complete
photograph. Both `camera` and `cameraSame` follow native page movement, and the
legacy camera/cloud strength settings and individual parallax factors are not
used. Large page jumps are absorbed into the next framing instead of being
discarded. With `aspectMode: 'fixed'`, `scrollMode: 'speed'`, or `scrollWind: false`,
buffered mode falls back to capture behavior and reports zero padding. Switching
from auto to fixed restores the original canvas sizing and foreground position.
The legacy `display` and `capture` modes retain their scroll strengths,
depth/cloud parallax, and jump
filter.

Natural snow exits use the existing spaced, inward birth-route selector instead
of repeatedly wrapping an outward-moving particle to the opposite edge. This
avoids rapid edge oscillation during depth changes and keeps inlets distributed
over long runs. A new generation discards the old particle's rendering history;
large flakes start beyond their optical footprint. If no route can enter the
view, the flake stays offscreen and retries after 0.25 seconds of simulation
time. Neighbor searches are deferred until a viable route is found. Camera
scroll transport retains modulo positions, with buffered travel limited to
the portion actually displayed by its cached viewport.

The portfolio uses the package's public `mountInkSnow` API from
`src/components/SnowBackground.svelte`. The original settings file is preserved
in `src/lib/snow-settings.json`. The site overrides `scrollMode` from
`cameraSame` to `camera` to reverse scroll motion and applies the package's
dark palette when the page's selected theme is dark. The header's saved choice
takes priority over the system preference. Palette updates keep the existing
canvas in place. The site also sets `scrollBlur: 0` to avoid
speed-dependent snow-kernel expansion and five-pass cloud exposure during fast
scrolling, while retaining the preset's ordinary snow blur. It selects
`scrollFrameRate: 'buffered'` to keep captures at the preset's 12fps while its
clipped native scroll layer moves between captures.
The buffer follows small scrolls immediately at 1:1. Once the native holder
reaches its reserve edge, the next capture applies only that visible movement,
using its last presented anchor as the reference. Excess travel is discarded
rather than jumping at recapture or building a delayed catch-up queue. Snow
and watercolor use the same bounded displacement, including direction changes
before the next capture. This keeps the existing raster dimensions, particle
reservoir and capture budget for both running and paused scenes.
Only `snowAmount` changes with scrolling:
100% at the top of the document and 25% below it. The engine
fades individual particles, so this reduces their count without resetting the
scene.

The renderer handles reduced-motion preferences, document visibility, resize,
and resource disposal. The wrapper forwards pointer movement without blocking
links or scrolling, because the decorative canvas has `pointer-events: none`.
The studio controls stay hidden and inaccessible.

`setPaused(value, { duration })` optionally eases the simulation clock over the
given number of milliseconds. The default call remains immediate. During a
smooth pause the renderer continues until its clock rate reaches zero, then
uses the existing held-frame pause path; `api.paused` becomes true when it
settles. Resume starts from zero rate. Mid-transition requests preserve the
current rate and particle state. Diagnostics expose the current clock rate,
requested pause target and whether a transition is in progress under `motion`.
This does not modify settings, rebuild particles or change the configured film
cadence. During easing, full captures keep the configured wall-clock fps while
the displayed poses slow down; returning to ordinary film ticks cannot sample
before the last eased picture. The portfolio requests 400 milliseconds only
for manual changes.
Reduced motion, hidden/offscreen suspension and calls without a duration settle
immediately instead of leaving an easing loop running.

The viewer-export modules are retained because the original engine imports
them. They are not invoked by the portfolio. Standalone portfolio previews are
built by the application's review build, not the engine's viewer export.

To upgrade, replace these runtime files together from the new source archive.
Reapply or retire the documented recycling and scroll-buffer patches and their
option/callback declarations.
No third-party runtime dependency or network request is required.
