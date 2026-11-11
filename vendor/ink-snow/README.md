# InkSnow 1.3.5 runtime

These files are copied unchanged from the user-provided
`ink-snow-svelte-scroll-v1.3.5.zip`, under `ink-snow-svelte/src/lib/`.
The source archive SHA-256 is `fa6cc9f75b37f4b73a4630197f82587444e88e1b50c76aef98a0938487512891`.

The portfolio uses the package's public `mountInkSnow` API from
`src/components/SnowBackground.svelte`. The original settings file is preserved
in `src/lib/snow-settings.json`. Only `snowAmount` changes while reading:
100% at the top of the document and 16% below it. The engine fades individual
particles, so this reduces their count without resetting the scene.

The renderer handles reduced-motion preferences, document visibility, resize,
and resource disposal. The wrapper forwards pointer movement without blocking
links or scrolling, because the decorative canvas has `pointer-events: none`.
The studio controls stay hidden and inaccessible.

The viewer-export modules are retained because the original engine imports
them. They are not invoked by the portfolio. Standalone portfolio previews are
built by the application's review build, not the engine's viewer export.

To upgrade, replace these runtime files together from the new source archive.
No third-party runtime dependency or network request is required.
