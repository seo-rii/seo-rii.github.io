import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { InkSnowAPI, InkSnowSettings } from '../vendor/ink-snow/engine.js';

type Particle = {
	id: number;
	generation: number;
	x: number;
	y: number;
	z: number;
	size: number;
	nearLens: boolean;
};
type Scene = InkSnowAPI & { step: (seconds: number) => void };
type SceneWindow = typeof window & { distributionScene: Scene };
type Diagnostics = {
	time: number;
	active: number;
	logicalWidth: number;
	logicalHeight: number;
	particles: Particle[];
};

async function mountScene(page: Page, amount: number) {
	const preset = JSON.parse(await readFile(resolve('src/lib/snow-settings.json'), 'utf8')) as {
		settings: InkSnowSettings;
	};
	await page.route('**/__snow-distribution__/**', async (route) => {
		const file = new URL(route.request().url()).pathname.slice('/__snow-distribution__/'.length);
		if (!file) {
			await route.fulfill({
				contentType: 'text/html',
				body: '<!doctype html><html><head><style>body{margin:0}#snow{position:fixed;inset:0;width:100%;height:100%}</style></head><body><div id="snow"></div></body></html>'
			});
		} else if (/^[a-z-]+\.js$/.test(file)) {
			await route.fulfill({
				contentType: 'text/javascript',
				body: await readFile(resolve('vendor/ink-snow', file), 'utf8')
			});
		} else await route.abort();
	});
	await page.goto('/__snow-distribution__/');
	await page.evaluate(
		async ({ settings, amount }) => {
			const modulePath = '/__snow-distribution__/engine.js';
			const { mountInkSnow } = (await import(
				modulePath
			)) as typeof import('../vendor/ink-snow/engine.js');
			// The particles renderer uses the original physics/recycling paths but
			// avoids intermediate field captures during the simulated warmup.
			const scene = mountInkSnow(document.getElementById('snow')!, {
				settings: {
					...settings,
					snowAmount: amount,
					renderer: 'particles',
					finish: 'none',
					film: 0,
					// Vintage mix adds a separate camera weave even with film at zero.
					vintageMix: 0,
					scrollMode: 'camera',
					scrollBlur: 0
				},
				paused: true,
				controls: false,
				debug: true
			}) as Scene;
			(window as SceneWindow).distributionScene = scene;
		},
		{ settings: preset.settings, amount }
	);
	await expect(page.locator('#snow canvas')).toBeVisible();
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
}

test('the field renderer preserves particle positions and paints snow after five minutes', async ({
	page
}) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 390, height: 844 });
	await mountScene(page, 0.25);
	const result = await page.evaluate(() => {
		const scene = (window as SceneWindow).distributionScene;
		for (let i = 0; i < 150; i++) scene.step(2);
		scene.update({ renderer: 'field' });
		const generations = new Map(
			(scene.diagnostics() as Diagnostics).particles.map((p) => [p.id, p.generation])
		);
		// Keep field history active across further natural exits and births.
		for (let i = 0; i < 24; i++) scene.step(1 / 12);
		const d = scene.diagnostics({ displayed: true }) as Diagnostics & {
			displayedParticles: Particle[];
		};
		const shown = new Map(d.displayedParticles.map((p) => [p.id, p]));
		const visible = d.particles.filter(
			(p) => !p.nearLens && p.x > 0 && p.x < d.logicalWidth && p.y > 0 && p.y < d.logicalHeight
		);
		const errors = visible.map((p) => {
			const displayed = shown.get(p.id);
			return displayed ? Math.hypot(displayed.x - p.x, displayed.y - p.y) : Infinity;
		});
		const canvas = scene.canvas;
		const context = canvas.getContext('2d')!;
		const withSnow = context.getImageData(0, 0, canvas.width, canvas.height).data;
		scene.update({ opacity: 0 });
		const withoutSnow = context.getImageData(0, 0, canvas.width, canvas.height).data;
		const scale = canvas.width / d.logicalWidth;
		const painted = visible.slice(0, 5).filter((p) => {
			const x = p.x * scale;
			const y = p.y * scale;
			const radius = Math.max(4, p.size * 2 * scale);
			for (
				let py = Math.max(0, Math.floor(y - radius));
				py < Math.min(canvas.height, y + radius);
				py++
			) {
				for (
					let px = Math.max(0, Math.floor(x - radius));
					px < Math.min(canvas.width, x + radius);
					px++
				) {
					const i = (py * canvas.width + px) * 4;
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
			time: d.time,
			visible: visible.length,
			recycled: d.particles.filter((p) => p.generation > generations.get(p.id)!).length,
			stale: visible.filter((p) => shown.get(p.id)?.generation !== p.generation).length,
			maxError: Math.max(...errors),
			painted
		};
	});
	expect(result.time).toBeCloseTo(302, 6);
	expect(result.visible).toBeGreaterThan(5);
	expect(result.recycled, 'Exercise natural births with field history active').toBeGreaterThan(0);
	expect(result.stale, 'Recycled particles discard their previous rendering history').toBe(0);
	expect(
		result.maxError,
		'Field history registers snow at its current physical position'
	).toBeLessThan(0.00001);
	expect(
		result.painted,
		'The final canvas contains snow near the visible particle centers'
	).toBeGreaterThanOrEqual(3);
});

for (const scenario of [
	{ name: 'desktop 100%', width: 1280, height: 720, amount: 1, warmup: 30 },
	{ name: 'mobile 100%', width: 390, height: 844, amount: 1, warmup: 30 },
	{ name: 'mobile 25% after five minutes', width: 390, height: 844, amount: 0.25, warmup: 300 }
]) {
	test(`${scenario.name} does not alternate particles between opposite edges on consecutive physics steps`, async ({
		page
	}) => {
		test.setTimeout(60_000);
		await page.setViewportSize({ width: scenario.width, height: scenario.height });
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await mountScene(page, scenario.amount);
		const result = await page.evaluate((warmup) => {
			const scene = (window as SceneWindow).distributionScene;
			for (let elapsed = 0; elapsed < warmup; elapsed += 2) scene.step(2);
			const initial = scene.diagnostics() as Diagnostics;
			type Sample = Particle & { time: number };
			const histories = new Map<number, Sample[]>();
			const flips: { id: number; axis: 'x' | 'y'; positions: Sample[] }[] = [];
			const invalid: Sample[] = [];
			let visibleSamples = 0;
			const side = (position: number, extent: number) =>
				position < 0 ? -1 : position > extent ? 1 : 0;
			function sample(diagnostics: Diagnostics) {
				for (const particle of diagnostics.particles) {
					const position = { ...particle, time: diagnostics.time };
					if (![particle.x, particle.y, particle.z].every(Number.isFinite)) {
						if (invalid.length < 10) invalid.push(position);
						continue;
					}
					if (
						particle.x >= 0 &&
						particle.x <= diagnostics.logicalWidth &&
						particle.y >= 0 &&
						particle.y <= diagnostics.logicalHeight
					)
						visibleSamples++;
					const history = histories.get(particle.id) ?? [];
					history.push(position);
					if (history.length > 3) history.shift();
					histories.set(particle.id, history);
					if (history.length !== 3) continue;
					for (const [axis, extent] of [
						['x', diagnostics.logicalWidth],
						['y', diagnostics.logicalHeight]
					] as const) {
						const [a, b, c] = history.map((entry) => side(entry[axis], extent));
						// Inspect actual projected movement, independently of generation
						// bookkeeping or the number of reported recycling operations.
						if (a !== 0 && b === -a && c === a && flips.length < 10) {
							flips.push({ id: particle.id, axis, positions: [...history] });
						}
					}
				}
			}
			sample(initial);
			for (let step = 0; step < 120; step++) {
				scene.step(1 / 120);
				sample(scene.diagnostics() as Diagnostics);
			}
			const final = scene.diagnostics() as Diagnostics;
			return {
				flips,
				invalid,
				visibleSamples,
				initialActive: initial.active,
				finalActive: final.active,
				elapsed: final.time - initial.time
			};
		}, scenario.warmup);
		expect(result.elapsed).toBeCloseTo(1, 6);
		expect(result.invalid, 'All active particles keep finite projected coordinates').toEqual([]);
		expect(
			result.flips,
			'Natural movement must not bounce between opposite edges at 120Hz'
		).toEqual([]);
		expect(result.initialActive).toBeGreaterThan(0);
		expect(result.finalActive, 'Recycling preserves the requested cohort').toBe(
			result.initialActive
		);
		expect(
			result.visibleSamples,
			'Avoid hiding every particle to prevent edge oscillation'
		).toBeGreaterThan(0);
		expect(errors).toEqual([]);
	});
}
