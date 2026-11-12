import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { InkSnowAPI, InkSnowOptions } from '../vendor/ink-snow/engine.js';

type Diagnostics = {
	captureCount: number;
	performance: { renderSamples: number; scrollReprojections: number };
	scroll: {
		cameraPosition: number;
		backgroundOffset: number;
		extraSnowTraceAtZ6: number;
		cloudTrace: number;
		cloudBlurPasses: number;
	};
};

type Harness = {
	api: InkSnowAPI;
	frame: (delta?: number) => void;
	read: () => Diagnostics;
	hash: () => number;
};

type HarnessWindow = typeof window & { snowHarness: Harness };

async function mountScene(page: Page, options: Pick<InkSnowOptions, 'scrollFrameRate'>, fps = 12) {
	const preset = JSON.parse(await readFile(resolve('src/lib/snow-settings.json'), 'utf8')) as {
		settings: InkSnowOptions['settings'];
	};
	await page.setViewportSize({ width: 240, height: 180 });
	// Serve the real vendored modules without adding a production-only test route.
	await page.route('**/__snow-test__/**', async (route) => {
		const file = new URL(route.request().url()).pathname.slice('/__snow-test__/'.length);
		if (!file) {
			await route.fulfill({
				contentType: 'text/html',
				body: '<!doctype html><html><head><style>body{margin:0;height:10000px}#snow{position:fixed;inset:0;width:240px;height:180px}</style></head><body><div id="snow"></div></body></html>'
			});
		} else if (/^[a-z-]+\.js$/.test(file)) {
			await route.fulfill({
				contentType: 'text/javascript',
				body: await readFile(resolve('vendor/ink-snow', file), 'utf8')
			});
		} else {
			await route.abort();
		}
	});
	await page.goto('/__snow-test__/');
	await page.evaluate(
		async ({ settings, options, fps }) => {
			const modulePath = '/__snow-test__/engine.js';
			const { mountInkSnow } = (await import(
				modulePath
			)) as typeof import('../vendor/ink-snow/engine.js');
			// Advance exactly 60 display frames per second. Wall-clock render cost
			// must not decide how many scene frames are due on a software GPU.
			let now = 1000;
			let nextId = 0;
			const callbacks = new Map<number, FrameRequestCallback>();
			window.requestAnimationFrame = (callback) => {
				callbacks.set(++nextId, callback);
				return nextId;
			};
			window.cancelAnimationFrame = (id) => callbacks.delete(id);
			Object.defineProperty(performance, 'now', { value: () => now });
			const host = document.getElementById('snow')!;
			const api = mountInkSnow(host, {
				...options,
				settings: {
					...settings,
					fps,
					snowAmount: 0.25,
					scrollMode: 'camera',
					scrollBlur: 0,
					finish: 'none'
				},
				paused: false,
				controls: false,
				scrollContainer: window
			});
			(window as HarnessWindow).snowHarness = {
				api,
				frame(delta = 0) {
					now += 1000 / 60;
					if (delta) {
						window.scrollTo(0, window.scrollY + delta);
						// Native scroll events are asynchronous; deliver each actual
						// position to the renderer before its deterministic frame.
						window.dispatchEvent(new Event('scroll'));
					}
					const pending = [...callbacks.values()];
					callbacks.clear();
					for (const callback of pending) callback(now);
				},
				read: () => api.diagnostics({ particles: false }) as Diagnostics,
				hash() {
					const { width, height } = api.canvas;
					const pixels = api.canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
					let hash = 2166136261;
					for (let i = 0; i < pixels.length; i += 97) hash = Math.imul(hash ^ pixels[i], 16777619);
					return hash >>> 0;
				}
			};
		},
		{ settings: preset.settings as InkSnowOptions['settings'], options, fps }
	);
	// Let the real layout/intersection observers settle, then establish a stable
	// animation clock before counting captures caused by the scroll sequence.
	await page.waitForTimeout(50);
	await page.evaluate(() => {
		const scene = (window as HarnessWindow).snowHarness;
		scene.frame();
		scene.frame();
	});
}

async function scrollOneSecond(page: Page) {
	return page.evaluate(() => {
		const scene = (window as HarnessWindow).snowHarness;
		const before = scene.read();
		for (let i = 0; i < 30; i++) scene.frame(16);
		const halfway = scene.read();
		for (let i = 0; i < 30; i++) scene.frame(-16);
		const after = scene.read();
		return {
			before,
			halfway,
			after,
			captures: after.captureCount - before.captureCount,
			renders: after.performance.renderSamples - before.performance.renderSamples,
			reprojections: after.performance.scrollReprojections - before.performance.scrollReprojections
		};
	});
}

test('capture cadence bounds scrolling work while preserving travel, pause and resume', async ({
	page
}) => {
	await mountScene(page, { scrollFrameRate: 'capture' });
	const result = await scrollOneSecond(page);
	expect(result.captures).toBeGreaterThanOrEqual(11);
	expect(result.captures).toBeLessThanOrEqual(13);
	expect(result.renders).toBe(result.captures);
	expect(result.reprojections).toBe(0);
	expect(result.halfway.scroll.cameraPosition).toBeGreaterThan(0);
	expect(result.halfway.scroll.backgroundOffset).toBeLessThan(0);
	expect(result.after.scroll.cameraPosition).toBeCloseTo(result.before.scroll.cameraPosition, 8);
	expect(result.after.scroll.backgroundOffset).toBeCloseTo(
		result.before.scroll.backgroundOffset,
		8
	);
	for (const sample of [result.halfway, result.after]) {
		expect(sample.scroll.extraSnowTraceAtZ6).toBe(0);
		expect(sample.scroll.cloudTrace).toBe(0);
		expect(sample.scroll.cloudBlurPasses).toBe(0);
	}

	const motion = await page.evaluate(() => {
		const scene = (window as HarnessWindow).snowHarness;
		scene.api.setPaused(true);
		const paused = { diagnostics: scene.read(), hash: scene.hash() };
		for (let i = 0; i < 60; i++) scene.frame(i < 30 ? 16 : -16);
		const held = { diagnostics: scene.read(), hash: scene.hash() };
		scene.api.setPaused(false);
		for (let i = 0; i < 60; i++) scene.frame(4);
		const resumed = { diagnostics: scene.read(), hash: scene.hash() };
		return { paused, held, resumed };
	});
	expect(motion.held).toEqual(motion.paused);
	expect(motion.resumed.diagnostics.captureCount).toBeGreaterThan(
		motion.held.diagnostics.captureCount
	);
	expect(motion.resumed.diagnostics.scroll.cameraPosition).toBeGreaterThan(
		motion.held.diagnostics.scroll.cameraPosition
	);
	expect(motion.resumed.hash).not.toBe(motion.held.hash);
});

test('capture cadence preserves the same scroll travel as the default display cadence', async ({
	page
}) => {
	await mountScene(page, {});
	const result = await scrollOneSecond(page);
	expect(result.captures).toBeGreaterThanOrEqual(11);
	expect(result.captures).toBeLessThanOrEqual(13);
	expect(result.reprojections).toBeGreaterThanOrEqual(45);
	expect(result.renders).toBe(60);

	await mountScene(page, { scrollFrameRate: 'capture' });
	const limited = await scrollOneSecond(page);
	for (const key of ['cameraPosition', 'backgroundOffset'] as const) {
		expect(limited.halfway.scroll[key] - limited.before.scroll[key]).toBeCloseTo(
			result.halfway.scroll[key] - result.before.scroll[key],
			8
		);
		expect(limited.after.scroll[key] - limited.before.scroll[key]).toBeCloseTo(
			result.after.scroll[key] - result.before.scroll[key],
			8
		);
	}
});

test('capture cadence still renders every display frame when fps is unlimited', async ({
	page
}) => {
	await mountScene(page, { scrollFrameRate: 'capture' }, 0);
	const result = await scrollOneSecond(page);
	expect(result.captures).toBe(60);
	expect(result.renders).toBe(60);
	expect(result.halfway.scroll.cameraPosition).toBeGreaterThan(0);
	expect(result.halfway.scroll.backgroundOffset).toBeLessThan(0);
});
