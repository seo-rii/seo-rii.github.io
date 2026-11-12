<script lang="ts">
	import { onMount } from 'svelte';
	import { mountInkSnow } from '../../vendor/ink-snow/engine.js';
	import type { InkSnowAPI, InkSnowSettings } from '../../vendor/ink-snow/engine.js';
	import preset from '../lib/snow-settings.json';
	import { observeColorScheme, type ColorScheme } from '../lib/color-scheme';

	let {
		paused = false,
		onColorSchemeChange
	}: { paused?: boolean; onColorSchemeChange?: (scheme: ColorScheme) => void } = $props();
	let host: HTMLDivElement;
	let api = $state.raw<InkSnowAPI | null>(null);
	let reducedMotion = $state(false);
	let snowAmount = $state(preset.settings.snowAmount);
	let ready = $state(false);

	$effect(() => {
		// Read both inputs even while manually paused. Synchronize the imperative
		// renderer; this does not assign any Svelte state.
		const motionPreference = reducedMotion;
		api?.setPaused(paused || motionPreference);
	});

	onMount(() => {
		// Keep the supplied preset intact; the engine changes particle count with
		// its own fade instead of restarting the animation or fading the canvas.
		const settings = preset.settings as InkSnowSettings;
		const readingSnowAmount = settings.snowAmount * 0.25;
		let atTop = window.scrollY <= 0;
		let motionTimer = 0;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		let colorScheme: ColorScheme = 'light';

		function themeSettings(): Pick<
			InkSnowSettings,
			'theme' | 'snowColor' | 'backgroundColor' | 'washColor'
		> {
			return colorScheme === 'dark'
				? {
						theme: 'dark',
						snowColor: '#e5eff8',
						backgroundColor: '#101923',
						washColor: '#355c80'
					}
				: {
						theme: settings.theme,
						snowColor: settings.snowColor,
						backgroundColor: settings.backgroundColor,
						washColor: settings.washColor
					};
		}
		const stopColorScheme = observeColorScheme((next) => {
			colorScheme = next;
			onColorSchemeChange?.(next);
			api?.update(themeSettings());
		});

		reducedMotion = reduced.matches;
		snowAmount = atTop ? settings.snowAmount : readingSnowAmount;
		const instance = mountInkSnow(host, {
			settings: {
				...settings,
				...themeSettings(),
				scrollMode: 'camera',
				// Speed-dependent exposure expands CPU kernels and redraws clouds five
				// times during fast scrolls. Keep the preset's normal falling-snow blur.
				scrollBlur: 0,
				snowAmount
			},
			// Let document scrolling stay smooth while the backdrop follows its 12fps preset.
			scrollFrameRate: 'capture',
			paused: paused || reduced.matches,
			controls: false,
			scrollContainer: window
		});
		if (!instance) return stopColorScheme;
		api = instance;
		ready = true;

		function updateAmount() {
			const nextAtTop = window.scrollY <= 0;
			if (nextAtTop === atTop) return;
			atTop = nextAtTop;
			snowAmount = atTop ? settings.snowAmount : readingSnowAmount;
			instance.update({ snowAmount });
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
			stopColorScheme();
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
	<div class="snow-surface">
		<div class="snow-host" bind:this={host}></div>
	</div>
</div>

<style>
	.snow-background {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
		background: var(--background, #ffffff);
	}

	.snow-surface {
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
	}
</style>
