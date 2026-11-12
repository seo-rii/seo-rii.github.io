# InkSnow 1.3.5 runtime

These files originate from the user-provided
`ink-snow-svelte-scroll-v1.3.5.zip`, under `ink-snow-svelte/src/lib/`.
The source archive SHA-256 is `fa6cc9f75b37f4b73a4630197f82587444e88e1b50c76aef98a0938487512891`.

The engine has two local patches. The optional mount setting
`scrollFrameRate: 'capture'` makes scroll redraws follow the configured `fps`.
It keeps collecting camera and cloud movement on every animation frame, then
shows the accumulated movement on the next capture. The default remains
display-rate scroll reprojection, including when no `fps` limit is set. The
option is also declared in `engine.d.ts`; all other runtime files are unchanged.

Natural snow exits use the existing spaced, inward birth-route selector instead
of repeatedly wrapping an outward-moving particle to the opposite edge. This
avoids rapid edge oscillation during depth changes and keeps inlets distributed
over long runs. A new generation discards the old particle's rendering history;
large flakes start beyond their optical footprint. If no route can enter the
view, the flake stays offscreen and retries after 0.25 seconds of simulation
time. Neighbor searches are deferred until a viable route is found. Camera
scroll transport retains its original modulo position and overshoot behavior.

The portfolio uses the package's public `mountInkSnow` API from
`src/components/SnowBackground.svelte`. The original settings file is preserved
in `src/lib/snow-settings.json`. The site overrides `scrollMode` from
`cameraSame` to `camera` to reverse scroll motion and applies the package's
dark palette when the system uses a dark color scheme. The palette updates in
place when the preference changes. The site also sets `scrollBlur: 0` to avoid
speed-dependent snow-kernel expansion and five-pass cloud exposure during fast
scrolling, while retaining the preset's ordinary snow blur. It selects
`scrollFrameRate: 'capture'` to keep the background at the preset's 12fps.
Only `snowAmount` changes with scrolling:
100% at the top of the document and 25% below it. The engine
fades individual particles, so this reduces their count without resetting the
scene.

The renderer handles reduced-motion preferences, document visibility, resize,
and resource disposal. The wrapper forwards pointer movement without blocking
links or scrolling, because the decorative canvas has `pointer-events: none`.
The studio controls stay hidden and inaccessible.

The viewer-export modules are retained because the original engine imports
them. They are not invoked by the portfolio. Standalone portfolio previews are
built by the application's review build, not the engine's viewer export.

To upgrade, replace these runtime files together from the new source archive.
Reapply or retire the documented recycling and scroll cadence patches and the
cadence option's declaration.
No third-party runtime dependency or network request is required.
