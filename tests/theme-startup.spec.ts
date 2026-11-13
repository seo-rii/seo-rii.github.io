import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

test('system changes between the head bootstrap and hydration are applied without animation', async ({
	browser,
	baseURL
}) => {
	for (const target of ['production', 'standalone'] as const) {
		for (const blocked of [false, true]) {
			const context = await browser.newContext({
				baseURL,
				colorScheme: 'light',
				reducedMotion: 'no-preference',
				locale: 'ko-KR'
			});
			const page = await context.newPage();
			await page.addInitScript((blocked) => {
				let dark = false;
				const nativeMatchMedia = window.matchMedia.bind(window);
				window.matchMedia = (query) => {
					const result = nativeMatchMedia(query);
					if (query === '(prefers-color-scheme: dark)') {
						Object.defineProperty(result, 'matches', { get: () => dark });
					}
					return result;
				};
				if (blocked) {
					for (const method of ['getItem', 'setItem', 'removeItem']) {
						Object.defineProperty(Storage.prototype, method, {
							configurable: true,
							value() {
								throw new DOMException('Blocked', 'SecurityError');
							}
						});
					}
				} else {
					localStorage.setItem('seorii-theme', 'light');
					localStorage.setItem('seorii-theme-system', 'light');
				}
				const observer = new MutationObserver(() => {
					if (!document.documentElement?.hasAttribute('data-theme')) return;
					// No change event is emitted: it occurs before the app subscribes.
					dark = true;
					observer.disconnect();
				});
				observer.observe(document, {
					subtree: true,
					attributes: true,
					attributeFilter: ['data-theme']
				});
			}, blocked);
			await context.setOffline(target === 'standalone');
			await page.goto(
				target === 'production' ? '/' : pathToFileURL(resolve('review/seorii-preview.html')).href
			);
			await expect(page.locator('.snow-background')).toHaveAttribute('data-ready', 'true');
			await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
			await expect(page.locator('.snow-host')).toHaveAttribute('data-theme', 'dark');
			await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
			if (!blocked) {
				expect(await page.evaluate(() => localStorage.getItem('seorii-theme'))).toBeNull();
			}
			await context.close();
		}
	}
});
