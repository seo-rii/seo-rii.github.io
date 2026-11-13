<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { mountInkSnow } from '../../vendor/ink-snow/engine.js';
	import type { InkSnowAPI, InkSnowSettings } from '../../vendor/ink-snow/engine.js';
	import preset from '../lib/snow-settings.json';

	let { paused = false, theme = null }: { paused?: boolean; theme?: 'light' | 'dark' | null } =
		$props();
	let host: HTMLDivElement;
	let surface: HTMLDivElement;
	let anchor: HTMLDivElement;
	let api = $state.raw<InkSnowAPI | null>(null);
	let reducedMotion = $state(false);
	let snowAmount = $state(preset.settings.snowAmount);
	let ready = $state(false);

	function themeSettings(
		selectedTheme: 'light' | 'dark'
	): Pick<InkSnowSettings, 'theme' | 'snowColor' | 'backgroundColor' | 'washColor'> {
		return selectedTheme === 'dark'
			? {
					theme: 'dark',
					snowColor: '#e5eff8',
					backgroundColor: '#101923',
					washColor: '#355c80'
				}
			: {
					theme: 'light',
					snowColor: preset.settings.snowColor,
					backgroundColor: preset.settings.backgroundColor,
					washColor: preset.settings.washColor
				};
	}

	$effect(() => {
		// Read both inputs even while manually paused. Synchronize the imperative
		// renderer; this does not assign any Svelte state.
		const motionPreference = reducedMotion;
		api?.setPaused(paused || motionPreference, { duration: motionPreference ? 0 : 400 });
	});

	$effect(() => {
		const selectedTheme = theme;
		if (selectedTheme) api?.update(themeSettings(selectedTheme));
	});

	onMount(() => {
		// Keep the supplied preset intact; the engine changes particle count with
		// its own fade instead of restarting the animation or fading the canvas.
		const settings = preset.settings as InkSnowSettings;
		const readingSnowAmount = settings.snowAmount * 0.25;
		let atTop = window.scrollY <= 0;
		let motionTimer = 0;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const rootTheme = document.documentElement.dataset.theme;
		const initialTheme =
			theme ??
			(rootTheme === 'light' || rootTheme === 'dark' ? rootTheme : null) ??
			(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

		reducedMotion = reduced.matches;
		snowAmount = atTop ? settings.snowAmount : readingSnowAmount;
		const instance = mountInkSnow(host, {
			settings: {
				...settings,
				...themeSettings(initialTheme),
				scrollMode: 'camera',
				// Speed-dependent exposure expands CPU kernels and redraws clouds five
				// times during fast scrolls. Keep the preset's normal falling-snow blur.
				scrollBlur: 0,
				snowAmount
			},
			// Scroll the cached overscan with the document. Only new animation
			// captures rebuild the picture and recenter its reusable margin.
			scrollFrameRate: 'buffered',
			onPresent({ scrollTop, padding }) {
				const fixed = padding === 0;
				anchor.style.height = fixed ? '0px' : `${Math.max(0, scrollTop)}px`;
				surface.style.position = fixed ? 'fixed' : 'sticky';
				surface.style.top = fixed ? '0px' : `${-padding}px`;
				surface.style.bottom = fixed ? 'auto' : `${-padding}px`;
			},
			onPausedChange(held) {
				if (!held) untrack(updateAmount);
			},
			paused: paused || reduced.matches,
			controls: false,
			scrollContainer: window
		});
		if (!instance) return;
		api = instance;
		ready = true;

		function updateAmount() {
			const nextAtTop = window.scrollY <= 0;
			atTop = nextAtTop;
			const renderer = api;
			// A held scene keeps its exact population across the top boundary.
			// Resume applies the current target through the renderer's normal fade.
			if (!renderer || renderer.paused || paused || reduced.matches) return;
			const nextAmount = atTop ? settings.snowAmount : readingSnowAmount;
			if (nextAmount === snowAmount) return;
			snowAmount = nextAmount;
			renderer.update({ snowAmount });
		}
		function updateMotionPreference() {
			reducedMotion = reduced.matches;
			// The engine also owns a media-query listener which changes its pause
			// state. Reapply our explicit pause after all those listeners have run.
			window.clearTimeout(motionTimer);
			motionTimer = window.setTimeout(() => {
				instance.setPaused(paused || reduced.matches);
			}, 0);
		}

		// The original engine listens on its stage. Forward non-bubbling events
		// to preserve pointerWind while all real input reaches the page content.
		const stage = instance.canvas.closest<HTMLElement>('.snow-stage');
		function forwardPointer(event: PointerEvent) {
			stage?.dispatchEvent(
				new PointerEvent('pointermove', {
					clientX: event.clientX,
					clientY: event.clientY,
					pointerType: event.pointerType,
					isPrimary: event.isPrimary
				})
			);
		}
		function leavePointer(event: PointerEvent) {
			if (!event.relatedTarget) stage?.dispatchEvent(new PointerEvent('pointerleave'));
		}

		window.addEventListener('scroll', updateAmount, { passive: true });
		window.addEventListener('pageshow', updateAmount);
		window.addEventListener('pointermove', forwardPointer, { passive: true });
		window.addEventListener('pointerout', leavePointer, { passive: true });
		reduced.addEventListener('change', updateMotionPreference);

		return () => {
			window.clearTimeout(motionTimer);
			window.removeEventListener('scroll', updateAmount);
			window.removeEventListener('pageshow', updateAmount);
			window.removeEventListener('pointermove', forwardPointer);
			window.removeEventListener('pointerout', leavePointer);
			reduced.removeEventListener('change', updateMotionPreference);
			instance.destroy();
			api = null;
		};
	});
</script>

<div
	class="snow-background"
	aria-hidden="true"
	inert
	data-ready={ready}
	data-snow-amount={snowAmount}
	data-paused={paused || reducedMotion}
>
	<div class="snow-anchor" bind:this={anchor}></div>
	<div class="snow-surface" bind:this={surface}>
		<div class="snow-viewport">
			<div class="snow-host" bind:this={host}></div>
		</div>
	</div>
</div>

<style>
	.snow-background {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		/* Clipping must not create a scroll container around the sticky cache. */
		overflow: clip;
		background: var(--background, #ffffff);
	}

	.snow-surface {
		position: sticky;
		top: 0;
		width: 100%;
		will-change: transform;
		/* Sticky travel uses the visible height, even when the address bar opens. */
		height: 100vh;
		height: 100dvh;
	}
	:global(:root:not([data-theme='dark'])) .snow-surface {
		/* Blend against the CSS backdrop, including browser-only darkening.
		   White restores the original bitmap: |1 - (1 - pixel)| = pixel.
		   A dark painted backdrop instead reveals the inverted light scene.
		   Keep this on the existing surface so cached scrolling stays native. */
		filter: invert(1);
		mix-blend-mode: difference;
	}

	.snow-viewport {
		width: 100%;
		/* Keep the drawing surface stable while browser chrome changes the clip. */
		height: 100vh;
		height: 100lvh;
	}

	.snow-host {
		width: 100%;
		height: 100%;
	}

	.snow-host :global(.snow-stage) {
		border-radius: 0;
		overflow: visible;
	}
</style>
