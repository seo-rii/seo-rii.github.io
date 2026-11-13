# seorii.page

Personal portfolio for Seohyun Lee, built with SvelteKit 3 and Svelte 5.
The site is prerendered for GitHub Pages with `@sveltejs/adapter-static`.

## Development

Use Node.js 22.17+ and pnpm 11 (`corepack enable`).

```sh
pnpm install
pnpm dev
```

```sh
pnpm check
pnpm lint
pnpm build
```

The SvelteKit configuration lives in `vite.config.js`, following the
[SvelteKit 3 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3).
`pnpm page` remains the manual production deployment command; building or
opening a pull request does not deploy the site.

## Offline review

```sh
pnpm review:build
```

Open [`review/seorii-preview.html`](review/seorii-preview.html) directly in a
browser. This is one file containing the application's JavaScript, CSS, original
snowflake image, and favicon. It works without a server or network connection.
The preview mounts the same `Portfolio.svelte` as the real SvelteKit route.
It includes both languages, navigation, and interactive snow. It excludes
analytics. External profile/project links still need an internet connection.
System fonts keep both versions free of remote font dependencies.

Regenerate and commit this file whenever the reviewed UI changes. The pull
request links to the downloadable artifact in this directory.

## Background and content

- The supplied InkSnow 1.3.5 runtime is in `vendor/ink-snow/`; its provenance and
  source archive checksum are documented there.
- `src/lib/snow-settings.json` preserves the supplied settings values.
- The site overrides `scrollMode` to `camera`, reversing the supplied preset's
  `cameraSame` direction: scrolling down moves the snow and clouds upward.
- The renderer paints a 128-logical-pixel margin above and below the viewport.
  A clipped sticky surface scrolls that cached image with the document between
  the preset's 12fps captures. It recenters the reusable margin when the next
  picture is presented; exhausting the margin holds its edge until that capture.
  Scrolling therefore responds without a full redraw or a JavaScript animation
  frame. Buffered scroll moves the whole picture at the document's 1:1 rate;
  individual snow depths and clouds keep their ordinary animated motion.
  `scrollBlur: 0` avoids expensive speed-dependent exposure while preserving
  the preset's normal falling-snow blur.
- The top of the document uses the original `snowAmount: 1`. Any scroll below
  the top reduces it to `0.25`; returning to the top restores it to `1`. The
  renderer transitions particle count without restarting the scene. While snow
  is paused (including reduced motion), its current density stays fixed across
  this boundary. Resuming applies the density for the current scroll position
  through the same fade.
- Natural falling snow re-enters through spaced, inward-moving routes when it
  leaves the view. This prevents depth changes from repeatedly bouncing the
  same particles between opposite edges and concentrating long-running inlets.
  Scroll-driven camera movement keeps its continuous transport behavior.
- The header's light/dark toggle switches the page, symbol, snow scene, and
  browser theme color together. An explicit choice is stored as `seorii-theme`
  and takes priority over system changes. Until a choice is made, the page
  follows the system preference, including changes while open. Theme changes
  keep the existing canvas, scroll density, and pause state.
- A small head script applies a saved theme before the page renders. The
  standalone review embeds the same script from `src/app.html`. If storage is
  blocked, the toggle still works for the current page.
- The light snow surface uses an inverted bitmap and `difference` blending
  against its CSS backdrop. A white backdrop restores the original scene;
  when a browser darkens that backdrop at paint time, the bright canvas can no
  longer cover it. The static symbol uses the same composition. The native
  dark palette keeps normal composition. No color probe, polling, or additional
  scroll handler is needed, and the existing cached surface stays in place.
- Forced-dark regression tests measure screenshot contrast with a light media
  preference, including the offline HTML. They exercise Chromium's paint
  transformation, not Samsung Internet itself. The earlier CSS system-color
  detector failed on the user's Samsung device and has been removed; this
  composition still needs confirmation on that device.
- The translucent reading surface keeps the snow visible behind the content.
- The snow stage uses the large viewport height (`100lvh`, with a `100vh`
  fallback) inside the page's clipped background. The logical viewport stays
  separate from the drawing margin. Mobile browser toolbars can change the
  visible area without resizing the canvas; window and orientation changes
  still update the scene dimensions. Pausing stops the scene's time while the
  cached surface still follows native document scrolling. Scrolling replenishes
  its reserve at the preset's capture rate without advancing the held film time;
  an idle paused scene schedules no animation frames.
- The mobile introduction follows its content height, keeping the profile
  links close to the introduction instead of leaving a large empty gap.
- The original snowflake symbol is a static image within the first screen.
- The background respects reduced motion, pauses in hidden tabs, and can be
  paused manually. It does not intercept links, keyboard input, or scrolling.
- Korean and English retain the existing biography, projects, open source, and
  awards. Browser language selects the initial language; the KO/EN controls
  persist an explicit preference when storage is available.

## Browser checks

```sh
pnpm exec playwright install chromium
pnpm build
pnpm review:build
pnpm test
```

The Chromium suite checks the production site and the downloaded `file://`
preview, including mobile widths, Korean/English controls, light/dark themes,
scroll-dependent snow count, pause and reduced motion, navigation, and offline
resource loading.
