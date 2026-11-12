import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { InkSnowAPI, InkSnowOptions } from '../vendor/ink-snow/engine.js';

type PresentedFrame = { scrollTop: number; padding: number; paused: boolean };
type Particle = {
	id: number;
	generation: number;
	x: number;
	y: number;
	z: number;
	size: number;
	nearLens?: boolean;
};
type Diagnostics = {
	captureCount: number;
	logicalWidth: number;
	logicalHeight: number;
	performance: { renderSamples: number; scrollReprojections: number };
	scroll: { cameraPosition: number; backgroundOffset: number };
	particles: Particle[];
	displayedParticles: Particle[];
};
type Geometry = {
	x: number;
	y: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
	backingWidth: number;
	backingHeight: number;
	canvases: number;
};
type Harness = {
	api: InkSnowAPI;
	input: (delta: number) => void;
	frame: (delta?: number) => void;
	read: () => Diagnostics;
	geometry: () => Geometry;
	presentation: () => PresentedFrame;
	paintProbe: () => void;
};
type HarnessWindow = typeof window & { bufferedScene: Harness };

async function mountScene(page: Page) {
	const preset = JSON.parse(await readFile(resolve('src/lib/snow-settings.json'), 'utf8')) as {
		settings: InkSnowOptions['settings'];
	};
	await page.setViewportSize({ width: 240, height: 180 });
	await page.route('**/__snow-buffered__/**', async (route) => {
		const file = new URL(route.request().url()).pathname.slice('/__snow-buffered__/'.length);
		if (!file) {
			await route.fulfill({
				contentType: 'text/html',
				body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0}#shell{position:relative;height:20000px}
#background{position:absolute;inset:0;overflow:clip;background:#00ff00}
#holder{position:fixed;top:0;width:100%;height:100vh;height:100lvh}
#snow{height:100%;width:100%}#snow .snow-stage{overflow:visible}
</style><div id="shell"><div id="background"><div id="anchor"></div><div id="holder"><div id="snow"></div></div></div></div>`
			});
		} else if (/^[a-z-]+\.js$/.test(file)) {
			await route.fulfill({
				contentType: 'text/javascript',
				body: await readFile(resolve('vendor/ink-snow', file), 'utf8')
			});
		} else await route.abort();
	});
	await page.goto('/__snow-buffered__/');
	await page.evaluate(
		async (settings) => {
			const modulePath = '/__snow-buffered__/engine.js';
			const { mountInkSnow } = (await import(
				modulePath
			)) as typeof import('../vendor/ink-snow/engine.js');
			let now = 1000;
			let nextId = 0;
			let lastPresentation: PresentedFrame = { scrollTop: 0, padding: 0, paused: false };
			const callbacks = new Map<number, FrameRequestCallback>();
			window.requestAnimationFrame = (callback) => {
				callbacks.set(++nextId, callback);
				return nextId;
			};
			window.cancelAnimationFrame = (id) => callbacks.delete(id);
			Object.defineProperty(performance, 'now', { value: () => now });
			const host = document.getElementById('snow')!;
			const holder = document.getElementById('holder')!;
			const anchor = document.getElementById('anchor')!;
			const api = mountInkSnow(host, {
				scrollFrameRate: 'buffered',
				settings: {
					...settings,
					fps: 12,
					snowAmount: 0.25,
					scrollMode: 'camera',
					scrollBlur: 0,
					finish: 'none',
					film: 0,
					vintageMix: 0,
					pointerWind: false
				},
				controls: false,
				paused: false,
				scrollContainer: window,
				onPresent(frame: PresentedFrame) {
					lastPresentation = { ...frame };
					const fixed = frame.paused || frame.padding === 0;
					anchor.style.height = fixed ? '0px' : `${frame.scrollTop}px`;
					holder.style.position = fixed ? 'fixed' : 'sticky';
					holder.style.top = fixed ? '0px' : `${-frame.padding}px`;
					holder.style.bottom = fixed ? 'auto' : `${-frame.padding}px`;
				}
			});
			function input(delta: number) {
				window.scrollTo(0, window.scrollY + delta);
				window.dispatchEvent(new Event('scroll'));
			}
			(window as HarnessWindow).bufferedScene = {
				api,
				input,
				frame(delta = 0) {
					now += 1000 / 60;
					if (delta) input(delta);
					const pending = [...callbacks.values()];
					callbacks.clear();
					for (const callback of pending) callback(now);
				},
				read: () => api.diagnostics({ displayed: true }) as Diagnostics,
				presentation: () => ({ ...lastPresentation }),
				geometry() {
					const rect = api.canvas.getBoundingClientRect();
					return {
						x: rect.x,
						y: rect.y,
						right: rect.right,
						bottom: rect.bottom,
						width: rect.width,
						height: rect.height,
						backingWidth: api.canvas.width,
						backingHeight: api.canvas.height,
						canvases: document.querySelectorAll('canvas').length
					};
				},
				paintProbe() {
					// A known mark makes the native compositor's visible pixel transport
					// unambiguous. No animation/capture runs while its movement is tested.
					const rect = api.canvas.getBoundingClientRect();
					const sx = api.canvas.width / rect.width;
					const sy = api.canvas.height / rect.height;
					const context = api.canvas.getContext('2d')!;
					context.save();
					context.setTransform(1, 0, 0, 1, 0, 0);
					context.fillStyle = '#ff00ff';
					context.fillRect((116 - rect.x) * sx, (86 - rect.y) * sy, 8 * sx, 8 * sy);
					context.restore();
				}
			};
		},
		preset.settings as InkSnowOptions['settings']
	);
	await page.waitForTimeout(50);
	await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		scene.frame();
		scene.frame();
	});
}

function expectCoverage(geometry: Geometry) {
	expect(geometry.x).toBeLessThanOrEqual(0.01);
	expect(geometry.y).toBeLessThanOrEqual(0.01);
	expect(geometry.right).toBeGreaterThanOrEqual(239.99);
	expect(geometry.bottom).toBeGreaterThanOrEqual(179.99);
}

async function visiblePixels(page: Page, points: { x: number; y: number }[]) {
	const image = await page.screenshot();
	return page.evaluate(
		async ({ image, points }) => {
			const source = new Image();
			source.src = image;
			await source.decode();
			const canvas = document.createElement('canvas');
			canvas.width = source.width;
			canvas.height = source.height;
			const context = canvas.getContext('2d')!;
			context.drawImage(source, 0, 0);
			return points.map(({ x, y }) => [...context.getImageData(x, y, 1, 1).data]);
		},
		{ image: `data:image/png;base64,${image.toString('base64')}`, points }
	);
}

test('native scrolling moves buffered pixels before the next scene capture', async ({ page }) => {
	await mountScene(page);
	const before = await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		scene.paintProbe();
		return {
			diagnostics: scene.read(),
			geometry: scene.geometry(),
			presentation: scene.presentation()
		};
	});
	expect(before.presentation.padding).toBeGreaterThan(8);
	expect((await visiblePixels(page, [{ x: 120, y: 90 }]))[0]).toEqual([255, 0, 255, 255]);
	const after = await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		scene.input(8);
		return { diagnostics: scene.read(), geometry: scene.geometry() };
	});
	expect(after.geometry.y - before.geometry.y).toBeCloseTo(-8, 4);
	expect(after.diagnostics.captureCount).toBe(before.diagnostics.captureCount);
	expect(after.diagnostics.performance.renderSamples).toBe(
		before.diagnostics.performance.renderSamples
	);
	const pixels = await visiblePixels(page, [
		{ x: 120, y: 82 },
		{ x: 120, y: 90 }
	]);
	expect(pixels[0], 'The existing bitmap moves with native document scrolling').toEqual([
		255, 0, 255, 255
	]);
	expect(pixels[1]).not.toEqual([255, 0, 255, 255]);
	expectCoverage(after.geometry);
});

test('buffered scrolling keeps capture cadence, reverses immediately and bounds buffer allocation', async ({
	page
}) => {
	test.setTimeout(60_000);
	await mountScene(page);
	const result = await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		const before = scene.read();
		const initial = scene.geometry();
		const immediateDeltas: number[] = [];
		const coverage: Geometry[] = [];
		for (let i = 0; i < 60; i++) {
			const delta = i < 30 ? 2 : -2;
			const y = scene.geometry().y;
			scene.input(delta);
			immediateDeltas.push(scene.geometry().y - y);
			coverage.push(scene.geometry());
			scene.frame();
		}
		const afterSecond = scene.read();
		// Exhaust and replenish the same reserve repeatedly; its size and DOM
		// allocation must not depend on total document travel.
		for (let i = 0; i < 180; i++) {
			scene.frame(8);
			coverage.push(scene.geometry());
		}
		return { before, afterSecond, initial, final: scene.geometry(), immediateDeltas, coverage };
	});
	const captures = result.afterSecond.captureCount - result.before.captureCount;
	expect(captures).toBeGreaterThanOrEqual(11);
	expect(captures).toBeLessThanOrEqual(13);
	expect(
		result.afterSecond.performance.renderSamples - result.before.performance.renderSamples
	).toBe(captures);
	expect(
		result.afterSecond.performance.scrollReprojections -
			result.before.performance.scrollReprojections
	).toBe(0);
	for (const [i, delta] of result.immediateDeltas.entries())
		expect(delta).toBeCloseTo(i < 30 ? -2 : 2, 4);
	expect(result.afterSecond.scroll.cameraPosition).toBeCloseTo(
		result.before.scroll.cameraPosition,
		6
	);
	for (const geometry of result.coverage) expectCoverage(geometry);
	for (const key of ['backingWidth', 'backingHeight', 'canvases'] as const)
		expect(result.final[key]).toBe(result.initial[key]);
});

test('reanchoring a held frame absorbs native movement without moving visible snow', async ({
	page
}) => {
	await mountScene(page);
	const result = await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		function positions() {
			const d = scene.read();
			const box = scene.geometry();
			const padding = scene.presentation().padding;
			const scale = box.width / d.logicalWidth;
			return d.displayedParticles
				.filter((p) => !p.nearLens)
				.map((p) => ({
					id: p.id,
					generation: p.generation,
					x: box.x + p.x * scale,
					y: box.y + padding + p.y * scale
				}));
		}
		scene.input(8);
		const moving = positions().filter((p) => p.x > 10 && p.x < 230 && p.y > 10 && p.y < 170);
		// No clock tick: only the native movement needs to enter the held image.
		scene.api.setPaused(true);
		const fixed = positions();
		scene.input(1200);
		scene.api.setPaused(false);
		const resumed = positions();
		const errors = (current: typeof fixed) =>
			moving.map((before) => {
				const after = current.find((p) => p.id === before.id && p.generation === before.generation);
				return after ? Math.hypot(after.x - before.x, after.y - before.y) : Infinity;
			});
		return {
			count: moving.length,
			pauseError: Math.max(...errors(fixed)),
			resumeError: Math.max(...errors(resumed))
		};
	});
	expect(result.count).toBeGreaterThan(5);
	expect(
		result.pauseError,
		'Absorbing the native offset keeps the held snow in place'
	).toBeLessThan(0.0001);
	expect(
		result.resumeError,
		'Travel while paused does not move the resumed photograph'
	).toBeLessThan(0.0001);
});

test('fixed aspect falls back to capture and restores buffered sizing when switched back', async ({
	page
}) => {
	await mountScene(page);
	const result = await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		const initial = scene.geometry();
		scene.api.update({ aspectMode: 'fixed', aspectWidth: 8, aspectHeight: 5 });
		const fixed = {
			geometry: scene.geometry(),
			presentation: scene.presentation(),
			logicalHeight: scene.read().logicalHeight
		};
		scene.api.update({ aspectMode: 'auto' });
		return {
			initial,
			fixed,
			restored: { geometry: scene.geometry(), presentation: scene.presentation() }
		};
	});
	expect(result.fixed.presentation.padding).toBe(0);
	expect(result.fixed.logicalHeight).toBe(560);
	expect(result.fixed.geometry.width / result.fixed.geometry.height).toBeCloseTo(1.6, 2);
	expect(result.restored.presentation.padding).toBeGreaterThan(0);
	expectCoverage(result.restored.geometry);
	for (const key of ['backingWidth', 'backingHeight', 'canvases'] as const)
		expect(result.restored.geometry[key]).toBe(result.initial[key]);
});

test('studio scroll controls refresh buffer bounds and the presentation fallback', async ({
	page
}) => {
	await mountScene(page);
	const states = await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		scene.api.setControls(true);
		scene.frame();
		const host = document.getElementById('snow')!;
		const wind = host.querySelector<HTMLInputElement>('[data-control="scrollWind"]')!;
		const mode = host.querySelector<HTMLSelectElement>('[data-control="scrollMode"]')!;
		const samples: { linked: boolean; mode: string; buffered: boolean; position: string }[] = [];
		function sample() {
			const settings = scene.api.getSettings();
			samples.push({
				linked: settings.scrollWind,
				mode: settings.scrollMode,
				buffered: scene.presentation().padding > 0,
				position: document.getElementById('holder')!.style.position
			});
		}
		for (const linked of [false, true]) {
			wind.checked = linked;
			wind.dispatchEvent(new Event('change', { bubbles: true }));
			sample();
		}
		for (const selected of ['speed', 'camera', 'speedBoth', 'cameraSame']) {
			mode.value = selected;
			mode.dispatchEvent(new Event('change', { bubbles: true }));
			sample();
		}
		return samples;
	});
	expect(states.map((state) => state.linked)).toEqual([false, true, true, true, true, true]);
	expect(states.map((state) => state.mode)).toEqual([
		'camera',
		'camera',
		'speed',
		'camera',
		'speed',
		'cameraSame'
	]);
	expect(states.map((state) => state.buffered)).toEqual([false, true, false, true, false, true]);
	expect(states.map((state) => state.position)).toEqual([
		'fixed',
		'sticky',
		'fixed',
		'sticky',
		'fixed',
		'sticky'
	]);
});

test('buffer exhaustion and large reverse jumps retain coverage and recapture at the current viewport', async ({
	page
}) => {
	await mountScene(page);
	const result = await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		const samples: { geometry: Geometry; anchor: number; scrollTop: number }[] = [];
		for (const top of [100, 4000, 0, 3000, 0]) {
			scene.input(top - window.scrollY);
			samples.push({
				geometry: scene.geometry(),
				anchor: scene.presentation().scrollTop,
				scrollTop: window.scrollY
			});
			for (let frame = 0; frame < 6; frame++) scene.frame();
			samples.push({
				geometry: scene.geometry(),
				anchor: scene.presentation().scrollTop,
				scrollTop: window.scrollY
			});
		}
		const diagnostics = scene.read();
		const rect = scene.geometry();
		const registrationError = Math.abs(rect.y + scene.presentation().padding);
		const context = scene.api.canvas.getContext('2d')!;
		const { width, height } = scene.api.canvas;
		const withSnow = context.getImageData(0, 0, width, height).data;
		scene.api.update({ opacity: 0 });
		const withoutSnow = context.getImageData(0, 0, width, height).data;
		const backingScale = width / diagnostics.logicalWidth;
		const paddingPixels = (scene.presentation().padding * width) / rect.width;
		const visible = diagnostics.displayedParticles.filter(
			(p) =>
				!p.nearLens &&
				p.x > p.size &&
				p.x < diagnostics.logicalWidth - p.size &&
				p.y > p.size &&
				p.y < diagnostics.logicalHeight - p.size
		);
		const painted = visible.slice(0, 8).filter((p) => {
			const x = p.x * backingScale;
			const y = p.y * backingScale + paddingPixels;
			const radius = Math.max(4, p.size * backingScale * 2);
			for (let py = Math.max(0, Math.floor(y - radius)); py < Math.min(height, y + radius); py++) {
				for (let px = Math.max(0, Math.floor(x - radius)); px < Math.min(width, x + radius); px++) {
					const i = (py * width + px) * 4;
					if (
						Math.max(
							Math.abs(withSnow[i] - withoutSnow[i]),
							Math.abs(withSnow[i + 1] - withoutSnow[i + 1]),
							Math.abs(withSnow[i + 2] - withoutSnow[i + 2])
						) > 3
					)
						return true;
				}
			}
			return false;
		}).length;
		return {
			samples,
			registrationError,
			painted,
			height: document.documentElement.scrollHeight,
			geometry: rect,
			diagnostics
		};
	});
	for (const sample of result.samples) expectCoverage(sample.geometry);
	for (const sample of result.samples.filter((_, i) => i % 2 === 1))
		expect(sample.anchor).toBe(sample.scrollTop);
	expect(
		result.registrationError,
		'Recapture removes the native offset as the new bitmap is presented'
	).toBeLessThan(0.01);
	expect(result.height, 'Scroll anchors must not extend the document').toBe(20000);
	expect(result.diagnostics.displayedParticles.length).toBeGreaterThan(0);
	expect(
		result.painted,
		'Recaptured snow is painted at viewport positions plus the overscan padding'
	).toBeGreaterThanOrEqual(3);
});

test('pause and reduced motion freeze native transport while theme changes preserve the buffer', async ({
	page
}) => {
	await mountScene(page);
	const initial = await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		scene.frame(8);
		scene.api.setPaused(true);
		scene.api.canvas.dataset.sentinel = 'same-canvas';
		return scene.geometry();
	});
	const frozen = createHash('sha256')
		.update(await page.screenshot())
		.digest('hex');
	await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		for (let i = 0; i < 30; i++) scene.frame(8);
	});
	expect(
		createHash('sha256')
			.update(await page.screenshot())
			.digest('hex')
	).toBe(frozen);
	const themed = await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		scene.api.update({
			theme: 'dark',
			snowColor: '#e5eff8',
			backgroundColor: '#101923',
			washColor: '#355c80'
		});
		return {
			paused: scene.api.paused,
			geometry: scene.geometry(),
			sentinel: scene.api.canvas.dataset.sentinel,
			theme: scene.api.getSettings().theme
		};
	});
	expect(themed.paused).toBe(true);
	expect(themed.theme).toBe('dark');
	expect(themed.sentinel).toBe('same-canvas');
	expect(
		createHash('sha256')
			.update(await page.screenshot())
			.digest('hex')
	).not.toBe(frozen);
	for (const key of ['backingWidth', 'backingHeight', 'canvases'] as const)
		expect(themed.geometry[key]).toBe(initial[key]);
	expectCoverage(themed.geometry);
	await page.evaluate(() => (window as HarnessWindow).bufferedScene.api.setPaused(false));
	await page.evaluate(() => (window as HarnessWindow).bufferedScene.input(8));
	const edgePixels = await visiblePixels(
		page,
		[20, 60, 100, 140, 180, 220].map((x) => ({ x, y: 179 }))
	);
	const edgeBrightness =
		edgePixels.reduce((sum, p) => sum + p[0] + p[1] + p[2], 0) / (edgePixels.length * 3);
	expect(edgeBrightness, 'Newly exposed reserve pixels use the current dark theme').toBeLessThan(
		128
	);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect
		.poll(() => page.evaluate(() => (window as HarnessWindow).bufferedScene.api.paused))
		.toBe(true);
	const reduced = createHash('sha256')
		.update(await page.screenshot())
		.digest('hex');
	await page.evaluate(() => {
		const scene = (window as HarnessWindow).bufferedScene;
		scene.input(120);
		for (let i = 0; i < 6; i++) scene.frame();
	});
	expect(
		createHash('sha256')
			.update(await page.screenshot())
			.digest('hex')
	).toBe(reduced);
});
