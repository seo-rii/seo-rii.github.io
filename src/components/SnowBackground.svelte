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
		let atTop = window.scrollY <= 0;
		let motionTimer = 0;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = reduced.matches;
		snowAmount = settings.snowAmount * (atTop ? 1 : 0.16);
		const instance = mountInkSnow(host, {
			// Reverse the supplied preset's cameraSame direction while keeping its other settings.
			settings: { ...settings, scrollMode: 'camera', snowAmount },
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
			snowAmount = settings.snowAmount * (atTop ? 1 : 0.16);
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
	<div class="snow-host" bind:this={host}></div>
</div>

<style>
	.snow-background {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
		background: #ffffff;
	}

	.snow-host {
		width: 100%;
		height: 100%;
	}

	.snow-host :global(.snow-stage) {
		border-radius: 0;
	}
</style>
