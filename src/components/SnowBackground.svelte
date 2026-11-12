<script lang="ts">
	import { onMount } from 'svelte';
	import { mountInkSnow } from '../../vendor/ink-snow/engine.js';
	import type { InkSnowAPI, InkSnowSettings } from '../../vendor/ink-snow/engine.js';
	import preset from '../lib/snow-settings.json';

	let { paused = false }: { paused?: boolean } = $props();
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
		const readingSnowAmount = settings.snowAmount * 0.16;
		let atTop = window.scrollY <= 0;
		let motionTimer = 0;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

		function themeSettings(): Pick<
			InkSnowSettings,
			'theme' | 'snowColor' | 'backgroundColor' | 'washColor'
		> {
			return colorScheme.matches
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

		reducedMotion = reduced.matches;
		snowAmount = atTop ? settings.snowAmount : readingSnowAmount;
		const instance = mountInkSnow(host, {
			// Reverse the supplied preset's cameraSame direction while keeping its other settings.
			settings: { ...settings, ...themeSettings(), scrollMode: 'camera', snowAmount },
			paused: paused || reduced.matches,
			controls: false,
			scrollContainer: window
		});
		if (!instance) return;
		api = instance;
		ready = true;

		function updateAmount() {
			const nextAtTop = window.scrollY <= 0;
			if (nextAtTop === atTop) return;
			atTop = nextAtTop;
			snowAmount = atTop ? settings.snowAmount : readingSnowAmount;
			instance.update({ snowAmount });
		}
		function updateColorScheme() {
			instance.update(themeSettings());
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
		colorScheme.addEventListener('change', updateColorScheme);

		return () => {
			window.clearTimeout(motionTimer);
			window.removeEventListener('scroll', updateAmount);
			window.removeEventListener('pageshow', updateAmount);
			window.removeEventListener('pointermove', forwardPointer);
			window.removeEventListener('pointerout', leavePointer);
			reduced.removeEventListener('change', updateMotionPreference);
			colorScheme.removeEventListener('change', updateColorScheme);
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
