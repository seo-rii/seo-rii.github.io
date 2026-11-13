import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import type { InkSnowAPI, InkSnowOptions } from '../vendor/ink-snow/engine.js';

type Diagnostics = {
	time: number;
	motion: { rate: number; targetPaused: boolean; transitioning: boolean };
	captureCount: number;
	backgroundPhase: number;
	suspended: boolean;
	particles: { id: number; generation: number; x: number; y: number }[];
};
type Harness = {
	api: InkSnowAPI;
	frames: (count: number) => void;
	read: () => Diagnostics;
	hide: () => void;
};
type HarnessWindow = typeof window & { pauseScene: Harness };

async function mountScene(page: Page, initialPaused = false) {
	const preset = JSON.parse(await readFile(resolve('src/lib/snow-settings.json'), 'utf8')) as {
		settings: InkSnowOptions['settings'];
	};
	await page.setViewportSize({ width: 240, height: 180 });
	await page.route('**/__snow-pause__/**', async (route) => {
		const file = new URL(route.request().url()).pathname.slice('/__snow-pause__/'.length);
		if (!file) {
			await route.fulfill({
				contentType: 'text/html',
				body: '<!doctype html><style>body{margin:0}#snow{width:240px;height:180px}</style><div id="snow"></div>'
			});
		} else if (/^[a-z-]+\.js$/.test(file)) {
			await route.fulfill({
				contentType: 'text/javascript',
				body: await readFile(resolve('vendor/ink-snow', file), 'utf8')
			});
		} else await route.abort();
	});
	await page.goto('/__snow-pause__/');
	await page.evaluate(
		async ({ settings, initialPaused }) => {
			const path = '/__snow-pause__/engine.js';
			const { mountInkSnow } = (await import(
				path
			)) as typeof import('../vendor/ink-snow/engine.js');
			let now = 1000;
			let nextId = 0;
			const callbacks = new Map<number, FrameRequestCallback>();
			window.requestAnimationFrame = (callback) => {
				callbacks.set(++nextId, callback);
				return nextId;
			};
			window.cancelAnimationFrame = (id) => callbacks.delete(id);
			Object.defineProperty(performance, 'now', { value: () => now });
			const api = mountInkSnow(document.getElementById('snow')!, {
				settings: { ...settings, finish: 'none', snowAmount: 0.25, pointerWind: false },
				scrollFrameRate: 'buffered',
				paused: initialPaused,
				controls: false
			});
			(window as HarnessWindow).pauseScene = {
				api,
				frames(count) {
					for (let i = 0; i < count; i++) {
						now += 1000 / 60;
						const pending = [...callbacks.values()];
						callbacks.clear();
						for (const callback of pending) callback(now);
					}
				},
				read: () => api.diagnostics() as Diagnostics,
				hide() {
					Object.defineProperty(document, 'hidden', { configurable: true, value: true });
					document.dispatchEvent(new Event('visibilitychange'));
				}
			};
		},
		{ settings: preset.settings, initialPaused }
	);
	await page.waitForTimeout(100);
	await page.evaluate(() => (window as HarnessWindow).pauseScene.frames(3));
}

test('manual pause decelerates the existing scene clock, settles, and remains still', async ({
	page
}) => {
	await mountScene(page);
	const result = await page.evaluate(() => {
		const scene = (window as HarnessWindow).pauseScene;
		const canvas = scene.api.canvas;
		const settings = scene.api.exportJSON();
		const before = scene.read();
		scene.api.setPaused(true, { duration: 400 });
		const requested = scene.read();
		const samples = [];
		for (let i = 0; i < 4; i++) {
			scene.frames(6);
			samples.push(scene.read());
		}
		scene.frames(1);
		const stopped = scene.read();
		scene.frames(60);
		return {
			before,
			requested,
			samples,
			stopped,
			held: scene.read(),
			settingsUnchanged: scene.api.exportJSON() === settings,
			sameCanvas: canvas === scene.api.canvas,
			paused: scene.api.paused
		};
	});
	expect(result.requested.time).toBe(result.before.time);
	expect(result.requested.particles).toEqual(result.before.particles);
	expect(result.requested.motion.targetPaused).toBe(true);
	expect(result.requested.motion.transitioning).toBe(true);
	const deltas = result.samples.map(
		(sample, i) => sample.time - (i ? result.samples[i - 1].time : result.before.time)
	);
	for (let i = 1; i < deltas.length; i++) expect(deltas[i]).toBeLessThan(deltas[i - 1]);
	expect(deltas[3]).toBeGreaterThan(0);
	expect(result.stopped.time - result.before.time).toBeCloseTo(0.2, 6);
	expect(result.stopped.captureCount - result.before.captureCount).toBeGreaterThanOrEqual(4);
	expect(result.stopped.captureCount - result.before.captureCount).toBeLessThanOrEqual(6);
	expect(result.stopped.motion).toEqual({ rate: 0, targetPaused: true, transitioning: false });
	expect(result.held).toEqual(result.stopped);
	expect(result.paused).toBe(true);
	expect(result.sameCanvas).toBe(true);
	expect(result.settingsUnchanged).toBe(true);
});

test('finishing an eased resume does not move the displayed scene sample backward', async ({
	page
}) => {
	await mountScene(page, true);
	const result = await page.evaluate(() => {
		const scene = (window as HarnessWindow).pauseScene;
		scene.api.setPaused(false, { duration: 400 });
		scene.frames(25);
		const completed = scene.read();
		scene.api.setPaused(true);
		return { completed, held: scene.read() };
	});
	expect(result.completed.motion.transitioning).toBe(false);
	expect(result.held.backgroundPhase).toBeCloseTo(result.completed.backgroundPhase, 10);
	expect(result.held.time).toBe(result.completed.time);
});

test('resume accelerates and reversing an unfinished pause preserves pose and velocity', async ({
	page
}) => {
	await mountScene(page, true);
	const result = await page.evaluate(() => {
		const scene = (window as HarnessWindow).pauseScene;
		scene.api.setPaused(false, { duration: 400 });
		scene.frames(1);
		const beginning = scene.read();
		const samples = [];
		for (let i = 0; i < 4; i++) {
			scene.frames(6);
			samples.push(scene.read());
		}
		scene.api.setPaused(true, { duration: 400 });
		scene.frames(8);
		const beforeReverse = scene.read();
		scene.api.setPaused(false, { duration: 400 });
		const afterReverse = scene.read();
		scene.frames(25);
		return {
			beginning,
			samples,
			beforeReverse,
			afterReverse,
			resumed: scene.read(),
			paused: scene.api.paused
		};
	});
	const deltas = result.samples.map(
		(sample, i) => sample.time - (i ? result.samples[i - 1].time : result.beginning.time)
	);
	for (let i = 1; i < deltas.length; i++) expect(deltas[i]).toBeGreaterThan(deltas[i - 1]);
	expect(result.afterReverse.time).toBe(result.beforeReverse.time);
	expect(result.afterReverse.particles).toEqual(result.beforeReverse.particles);
	expect(result.afterReverse.motion.rate).toBeCloseTo(result.beforeReverse.motion.rate, 10);
	expect(result.resumed.motion).toEqual({ rate: 1, targetPaused: false, transitioning: false });
	expect(result.resumed.time).toBeGreaterThan(result.afterReverse.time);
	expect(result.paused).toBe(false);
});

test('immediate API, reduced motion and a hidden page stop without a residual easing loop', async ({
	page
}) => {
	await mountScene(page);
	const immediate = await page.evaluate(() => {
		const scene = (window as HarnessWindow).pauseScene;
		scene.api.setPaused(true);
		const before = scene.read();
		scene.frames(30);
		return { before, after: scene.read(), paused: scene.api.paused };
	});
	expect(immediate.paused).toBe(true);
	expect(immediate.after).toEqual(immediate.before);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const reduced = await page.evaluate(() => {
		const scene = (window as HarnessWindow).pauseScene;
		scene.api.setPaused(false);
		scene.frames(3);
		scene.api.setPaused(true, { duration: 400 });
		return { paused: scene.api.paused, motion: scene.read().motion };
	});
	expect(reduced).toEqual({
		paused: true,
		motion: { rate: 0, targetPaused: true, transitioning: false }
	});
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	const hidden = await page.evaluate(() => {
		const scene = (window as HarnessWindow).pauseScene;
		scene.api.setPaused(false);
		scene.frames(3);
		scene.api.setPaused(true, { duration: 400 });
		scene.frames(6);
		scene.hide();
		const before = scene.read();
		scene.frames(60);
		return { before, after: scene.read(), paused: scene.api.paused };
	});
	expect(hidden.paused).toBe(true);
	expect(hidden.before.suspended).toBe(true);
	expect(hidden.before.motion.transitioning).toBe(false);
	expect(hidden.after).toEqual(hidden.before);
});

for (const target of ['production', 'standalone'] as const) {
	test(`${target} uses an eased manual pause and keeps its canvas on resume`, async ({
		page,
		context
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await context.setOffline(target === 'standalone');
		await page.goto(
			target === 'production' ? '/' : pathToFileURL(resolve('review/seorii-preview.html')).href
		);
		await expect(page.locator('.snow-background')).toHaveAttribute('data-ready', 'true');
		await page
			.locator('.snow-host canvas')
			.evaluate((canvas) => canvas.setAttribute('data-pause-probe', 'preserved'));
		const intermediate = await page.evaluate(async () => {
			(document.querySelector('.snow-toggle') as HTMLButtonElement).click();
			await Promise.resolve();
			await Promise.resolve();
			return {
				requested: document.querySelector('.snow-toggle')!.getAttribute('aria-pressed'),
				running: (document.querySelector('.snow-host') as HTMLElement).dataset.running
			};
		});
		expect(intermediate).toEqual({ requested: 'true', running: 'true' });
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
		await page.locator('.snow-toggle').click();
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
		await expect(page.locator('.snow-host canvas')).toHaveAttribute(
			'data-pause-probe',
			'preserved'
		);
	});
}
