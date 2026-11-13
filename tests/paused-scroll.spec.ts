import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

for (const target of ['production', 'standalone'] as const) {
	test(`${target}: paused snow keeps its density across the top boundary and applies the current target on resume`, async ({
		page,
		context
	}) => {
		test.setTimeout(60_000);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		if (target === 'standalone') await context.setOffline(true);
		await page.goto(
			target === 'production' ? '/' : pathToFileURL(resolve('review/seorii-preview.html')).href
		);
		const snow = page.locator('.snow-background');
		const toggle = page.locator('.snow-toggle');
		const canvas = page.locator('.snow-host canvas');
		await expect(snow).toHaveAttribute('data-ready', 'true');
		await expect(snow).toHaveAttribute('data-snow-amount', '1');
		await canvas.evaluate((element) => element.setAttribute('data-paused-scene', 'same'));
		await toggle.dispatchEvent('click');
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
		for (const top of [1, 0, 1, 0, 800, 0, 1]) {
			await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), top);
			await page.waitForTimeout(110);
			await expect(snow).toHaveAttribute('data-snow-amount', '1');
			await expect(page.locator('.snow-host [data-control="snowAmount-value"]')).toHaveText('100%');
			await expect(canvas).toHaveAttribute('data-paused-scene', 'same');
			await expect(page.locator('.snow-surface')).toHaveCSS('position', 'sticky');
			const coverage = await canvas.evaluate((element) => {
				const box = element.getBoundingClientRect();
				return box.top <= 0.01 && box.bottom >= innerHeight - 0.01;
			});
			expect(coverage).toBe(true);
		}
		await toggle.dispatchEvent('click');
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
		await expect(snow).toHaveAttribute('data-snow-amount', '0.25');
		await toggle.dispatchEvent('click');
		await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
		await expect(snow).toHaveAttribute('data-snow-amount', '0.25');
		await toggle.dispatchEvent('click');
		await expect(snow).toHaveAttribute('data-snow-amount', '1');
	});
}

test('reduced motion holds the initial population until the preference resumes animation', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await expect(page.locator('.snow-background')).toHaveAttribute('data-ready', 'true');
	await page.evaluate(() => scrollTo({ top: 1, behavior: 'instant' }));
	await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '1');
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
	await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
});
