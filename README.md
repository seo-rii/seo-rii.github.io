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
- Scroll redraws follow the preset's 12fps cadence instead of rendering the
  entire backdrop at the display refresh rate. `scrollBlur: 0` removes the
  expensive speed-dependent exposure while preserving the preset's normal
  falling-snow blur, camera motion, and cloud movement.
- The top of the document uses the original `snowAmount: 1`. Any scroll below
  the top reduces it to `0.25`; returning to the top restores it to `1`. The
  renderer transitions particle count without restarting the scene.
- The page and snow scene follow the system's light or dark color scheme,
  including changes while the page is open. Theme changes keep the existing
  canvas, scroll density, and pause state.
- The translucent reading surface keeps the snow visible behind the content.
- The snow stage uses the large viewport height (`100lvh`, with a `100vh`
  fallback) inside a clipped fixed viewport. Mobile browser toolbars can change
  the visible area without resizing the canvas; window and orientation changes
  still update the scene dimensions.
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
