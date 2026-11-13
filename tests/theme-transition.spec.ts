import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type Target = 'production' | 'standalone';
type ProbeWindow = typeof window & { __themeTransitions?: ViewTransition[] };
const errorsByPage = new WeakMap<Page, string[]>();

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
	const errors: string[] = [];
	errorsByPage.set(page, errors);
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (['error', 'warning'].includes(message.type()) && /hydrat/i.test(message.text())) {
			errors.push(message.text());
		}
	});
	await page.addInitScript(() => {
		const transitions: ViewTransition[] = [];
		(window as ProbeWindow).__themeTransitions = transitions;
		if (!document.startViewTransition) return;
		const start = document.startViewTransition.bind(document);
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value(update: () => void | Promise<void>) {
				const transition = start(update);
				transitions.push(transition);
				return transition;
			}
		});
	});
});

test.afterEach(({ page }) => {
	expect(errorsByPage.get(page), 'Theme changes cause no runtime or hydration errors').toEqual([]);
});

async function openTarget(page: Page, context: BrowserContext, target: Target) {
	await context.setOffline(target === 'standalone');
	await page.goto(
		target === 'production' ? '/' : pathToFileURL(resolve('review/seorii-preview.html')).href
	);
	await expect(page.locator('.snow-background')).toHaveAttribute('data-ready', 'true');
	await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
	expect(await transitionCount(page), 'Initial rendering has no theme animation').toBe(0);
}

async function transitionCount(page: Page) {
	return page.evaluate(() => (window as ProbeWindow).__themeTransitions?.length ?? 0);
}

async function transitionReady(page: Page) {
	await page.evaluate(async () => {
		const transition = (window as ProbeWindow).__themeTransitions?.at(-1);
		if (!transition) throw new Error('No ViewTransition was started');
		await transition.ready;
	});
}

async function transitionsFinished(page: Page) {
	await page.evaluate(async () => {
		await Promise.allSettled(
			((window as ProbeWindow).__themeTransitions ?? []).map((transition) => transition.finished)
		);
	});
	await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
}

async function expectTheme(page: Page, theme: 'light' | 'dark') {
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
	await expect(page.locator('.snow-host')).toHaveAttribute('data-theme', theme);
	await expect(page.locator('.theme-toggle')).toHaveAttribute(
		'aria-pressed',
		String(theme === 'dark')
	);
}

for (const target of ['production', 'standalone'] as const) {
	test(`${target}: the real page crossfade interpolates both snapshots and keeps paused snow`, async ({
		page,
		context
	}) => {
		await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
		await openTarget(page, context, target);
		// Freeze a reading-density scene before testing its palette transition.
		// A scene paused at the top intentionally keeps its full population.
		await page.evaluate(() => scrollTo({ top: 1, behavior: 'instant' }));
		await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
		await page.locator('.snow-toggle').dispatchEvent('click');
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
		await page.locator('.snow-host canvas').evaluate((canvas) => {
			canvas.setAttribute('data-crossfade-probe', 'preserved');
		});
		await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
		await page.locator('.theme-toggle').dispatchEvent('click');
		await transitionReady(page);
		await expect(page.locator('html')).toHaveAttribute('data-theme-transition', 'true');
		const samples = await page.evaluate(() => {
			// Pause the browser's actual opacity animations to sample deterministic
			// intermediate frames instead of depending on screenshot timing.
			const fades = document.getAnimations().filter((animation) => {
				return (
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((keyframe) => keyframe.opacity !== undefined)
				);
			});
			const durations = fades.map((animation) => Number(animation.effect!.getTiming().duration));
			for (const animation of fades) animation.pause();
			const sample = (progress: number) => {
				for (let index = 0; index < fades.length; index++) {
					fades[index].currentTime = durations[index] * progress;
				}
				return {
					old: Number(
						getComputedStyle(document.documentElement, '::view-transition-old(root)').opacity
					),
					new: Number(
						getComputedStyle(document.documentElement, '::view-transition-new(root)').opacity
					)
				};
			};
			const quarter = sample(0.25);
			const threeQuarters = sample(0.75);
			for (const animation of fades) animation.play();
			return { count: fades.length, durations, quarter, threeQuarters };
		});
		expect(samples.count).toBeGreaterThanOrEqual(2);
		for (const duration of samples.durations) {
			expect(duration).toBeGreaterThanOrEqual(250);
			expect(duration).toBeLessThanOrEqual(500);
		}
		for (const sample of [samples.quarter, samples.threeQuarters]) {
			expect(sample.old).toBeGreaterThan(0);
			expect(sample.old).toBeLessThan(1);
			expect(sample.new).toBeGreaterThan(0);
			expect(sample.new).toBeLessThan(1);
		}
		expect(samples.quarter.old).toBeGreaterThan(samples.threeQuarters.old);
		expect(samples.quarter.new).toBeLessThan(samples.threeQuarters.new);
		await transitionsFinished(page);
		await expectTheme(page, 'dark');
		expect(await page.evaluate(() => scrollY)).toBe(1);
		await expect(page.locator('.snow-host canvas')).toHaveAttribute(
			'data-crossfade-probe',
			'preserved'
		);
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
		await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
	});
}

test('rapid reversals and a later system change leave the latest theme with no stale overlay', async ({
	page,
	context
}) => {
	for (const target of ['production', 'standalone'] as const) {
		await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
		await openTarget(page, context, target);
		await page.locator('.theme-toggle').dispatchEvent('click');
		await transitionReady(page);
		await page.locator('.theme-toggle').evaluate((button) => {
			for (let index = 0; index < 3; index++) (button as HTMLButtonElement).click();
		});
		await transitionsFinished(page);
		await expectTheme(page, 'light');
		expect(await page.evaluate(() => localStorage.getItem('seorii-theme'))).toBe('light');
		await page.locator('.theme-toggle').dispatchEvent('click');
		await page.emulateMedia({ colorScheme: 'dark' });
		await expect.poll(() => page.evaluate(() => localStorage.getItem('seorii-theme'))).toBeNull();
		await page.emulateMedia({ colorScheme: 'light' });
		await transitionsFinished(page);
		await expectTheme(page, 'light');
		expect(await page.evaluate(() => localStorage.getItem('seorii-theme-system'))).toBe('light');
	}
});

test('reduced motion skips initial and live crossfades and can stop an active transition', async ({
	page,
	context
}) => {
	for (const target of ['production', 'standalone'] as const) {
		await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
		await openTarget(page, context, target);
		await page.locator('.theme-toggle').dispatchEvent('click');
		await expectTheme(page, 'dark');
		expect(await transitionCount(page)).toBe(0);
		await page.emulateMedia({ colorScheme: 'dark' });
		await expect.poll(() => page.evaluate(() => localStorage.getItem('seorii-theme'))).toBeNull();
		await page.emulateMedia({ colorScheme: 'light' });
		await expectTheme(page, 'light');
		expect(await transitionCount(page)).toBe(0);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await expect(page.locator('.snow-toggle')).toBeEnabled();
		await page.locator('.theme-toggle').dispatchEvent('click');
		await transitionReady(page);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(page.locator('.snow-toggle')).toBeDisabled();
		await transitionsFinished(page);
		await expectTheme(page, 'dark');
		const count = await transitionCount(page);
		await page.locator('.theme-toggle').dispatchEvent('click');
		await expectTheme(page, 'light');
		expect(await transitionCount(page)).toBe(count);
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
	}
});

test('browsers without ViewTransition still switch manually and follow system changes', async ({
	page,
	context
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: undefined
		});
	});
	for (const target of ['production', 'standalone'] as const) {
		await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
		await openTarget(page, context, target);
		await page.locator('.theme-toggle').dispatchEvent('click');
		await expectTheme(page, 'dark');
		await page.emulateMedia({ colorScheme: 'dark' });
		await expect.poll(() => page.evaluate(() => localStorage.getItem('seorii-theme'))).toBeNull();
		await page.emulateMedia({ colorScheme: 'light' });
		await expectTheme(page, 'light');
		await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
	}
});
