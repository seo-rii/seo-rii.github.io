import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';
type Target = 'production' | 'standalone';
type BootstrapWindow = typeof window & {
	__themeAtBody?: { theme: string | undefined; snowReady: string | null };
};

const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
	const errors: string[] = [];
	browserErrors.set(page, errors);
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (['error', 'warning'].includes(message.type()) && /hydrat/i.test(message.text())) {
			errors.push(message.text());
		}
	});
});

test.afterEach(({ page }) => {
	expect(browserErrors.get(page), 'Theme changes cause no runtime or hydration errors').toEqual([]);
});

async function openTarget(page: Page, context: BrowserContext, target: Target) {
	await context.setOffline(target === 'standalone');
	await page.goto(
		target === 'production' ? '/' : pathToFileURL(resolve('review/seorii-preview.html')).href
	);
	await expectSnowReady(page);
}

async function expectSnowReady(page: Page) {
	await expect(page.locator('.snow-background')).toHaveAttribute('data-ready', 'true');
	await expect(page.locator('.snow-host canvas')).toBeVisible();
}

async function expectTheme(page: Page, theme: Theme, language: 'ko' | 'en' = 'ko') {
	const dark = theme === 'dark';
	const palette = dark
		? { background: '#101923', snow: '#e5eff8', wash: '#355c80', rgb: 'rgb(16, 25, 35)' }
		: { background: '#ffffff', snow: '#090e13', wash: '#4f87ad', rgb: 'rgb(255, 255, 255)' };
	const button = page.getByRole('button', {
		name: language === 'ko' ? '다크 모드' : 'Dark mode',
		exact: true
	});
	await expect(page.locator('header .theme-toggle')).toHaveCount(1);
	await expect(button).toHaveAttribute('aria-pressed', String(dark));
	await expect(button).toHaveAttribute(
		'title',
		language === 'ko'
			? dark
				? '라이트 모드로 전환'
				: '다크 모드로 전환'
			: dark
				? 'Switch to light mode'
				: 'Switch to dark mode'
	);
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
	await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
	await expect(page.locator('html')).toHaveCSS('background-color', palette.rgb);
	await expect(page.locator('.snow-host')).toHaveAttribute('data-theme', theme);
	for (const [control, value] of [
		['backgroundColor', palette.background],
		['snowColor', palette.snow],
		['washColor', palette.wash]
	]) {
		await expect(page.locator(`.snow-host [data-control="${control}"]`)).toHaveValue(value);
	}
	const themeColor = await page.locator('meta[name="theme-color"]').evaluateAll((elements) => {
		const active = elements.find((element) => {
			const media = element.getAttribute('media');
			return !media || matchMedia(media).matches;
		});
		return active?.getAttribute('content')?.toLowerCase();
	});
	expect(themeColor, 'Browser chrome uses the selected theme, including an OS override').toBe(
		palette.background
	);
}

async function canvasState(page: Page) {
	return page.locator('.snow-host canvas').evaluate((element) => {
		const canvas = element as HTMLCanvasElement;
		return {
			width: canvas.width,
			height: canvas.height,
			cssHeight: canvas.style.height,
			cssTop: canvas.style.top
		};
	});
}

async function settleCanvas(page: Page) {
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	// Initial asset recovery may present once after the engine's ready signal.
	await page.waitForTimeout(350);
}

async function expectReadingState(page: Page, paused: boolean) {
	await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
	await expect(page.locator('.snow-host [data-control="snowAmount-value"]')).toHaveText('25%');
	await expect(page.locator('.snow-background')).toHaveAttribute('data-paused', String(paused));
	await expect(page.locator('.snow-toggle')).toHaveAttribute('aria-pressed', String(paused));
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', String(!paused));
	expect(await page.evaluate(() => window.scrollY)).toBe(1);
	await expect(page.locator('.snow-host canvas')).toHaveCount(1);
	await expect(page.locator('.snow-host canvas')).toHaveAttribute('data-theme-probe', 'preserved');
}

for (const target of ['production', 'standalone'] as const) {
	test(`${target}: manual themes persist until the system changes and preserve active or paused snow`, async ({
		page,
		context
	}) => {
		test.setTimeout(60_000);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
		await openTarget(page, context, target);
		await expectTheme(page, 'light');
		await page.emulateMedia({ colorScheme: 'dark' });
		await expectTheme(page, 'dark');
		expect(await page.evaluate(() => localStorage.getItem('seorii-theme'))).toBeNull();

		await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' }));
		await settleCanvas(page);
		await page.locator('.snow-host canvas').evaluate((canvas) => {
			canvas.setAttribute('data-theme-probe', 'preserved');
		});
		const activeBuffer = await canvasState(page);
		await expectReadingState(page, false);
		// Playwright's pointer setup scrolls this header to the top before clicking.
		// Isolate the handler here; the 320px test exercises real keyboard activation.
		await page.getByRole('button', { name: '다크 모드', exact: true }).dispatchEvent('click');
		await expectTheme(page, 'light');
		expect(await page.evaluate(() => localStorage.getItem('seorii-theme'))).toBe('light');
		await expectReadingState(page, false);
		expect(await canvasState(page), 'Active overscan buffer survives the palette update').toEqual(
			activeBuffer
		);
		await page.emulateMedia({ colorScheme: 'light' });
		await expectTheme(page, 'light');
		expect(await page.evaluate(() => localStorage.getItem('seorii-theme'))).toBeNull();
		await page.emulateMedia({ colorScheme: 'dark' });
		await expectTheme(page, 'dark');

		await page.locator('.snow-toggle').dispatchEvent('click');
		// Keep the header visible while retaining the below-top reading amount.
		await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' }));
		await settleCanvas(page);
		const pausedBuffer = await canvasState(page);
		await expectReadingState(page, true);
		await page.getByRole('button', { name: '다크 모드', exact: true }).dispatchEvent('click');
		await expectTheme(page, 'light');
		await expectReadingState(page, true);
		expect(await canvasState(page), 'A theme choice preserves the held buffer and canvas').toEqual(
			pausedBuffer
		);
		expect(await page.evaluate(() => localStorage.getItem('seorii-theme'))).toBe('light');
		await page.getByRole('button', { name: 'English', exact: true }).click();
		await expectTheme(page, 'light', 'en');
		await page.reload();
		await expectSnowReady(page);
		await expectTheme(page, 'light', 'en');
		await page.emulateMedia({ colorScheme: 'light' });
		await expectTheme(page, 'light', 'en');
		expect(await page.evaluate(() => localStorage.getItem('seorii-theme'))).toBeNull();
		await page.emulateMedia({ colorScheme: 'dark' });
		await expectTheme(page, 'dark', 'en');
	});
}

test('both artifacts resolve saved and changed system themes before hydration', async ({
	page,
	context
}) => {
	test.setTimeout(60_000);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => {
		// The parser reaches <body> after the head bootstrap, before app mounting.
		const observer = new MutationObserver(() => {
			if (!document.body) return;
			(window as BootstrapWindow).__themeAtBody = {
				theme: document.documentElement.dataset.theme,
				snowReady: document.querySelector('.snow-background')?.getAttribute('data-ready') ?? null
			};
			observer.disconnect();
		});
		observer.observe(document, { childList: true, subtree: true });
	});
	for (const target of ['production', 'standalone'] as const) {
		await openTarget(page, context, target);
		for (const [saved, system, previousSystem, expected] of [
			['light', 'dark', 'dark', 'light'],
			['dark', 'light', 'light', 'dark'],
			['dark', 'light', 'dark', 'light'],
			['light', 'dark', 'light', 'dark'],
			['light', 'dark', null, 'light'],
			['not-a-theme', 'dark', 'dark', 'dark']
		] as const) {
			await page.evaluate(
				({ theme, previousSystem }) => {
					localStorage.setItem('seorii-theme', theme);
					if (previousSystem === null) localStorage.removeItem('seorii-theme-system');
					else localStorage.setItem('seorii-theme-system', previousSystem);
				},
				{ theme: saved, previousSystem }
			);
			// Change the OS after leaving the app: no live listener can clear the
			// stored choice, so this specifically exercises the head bootstrap.
			await page.goto('about:blank');
			await page.emulateMedia({ colorScheme: system });
			await openTarget(page, context, target);
			const firstBody = await page.evaluate(() => (window as BootstrapWindow).__themeAtBody);
			expect(firstBody?.snowReady, `${target} probe precedes snow mounting`).not.toBe('true');
			expect(firstBody?.theme, `${target} bootstrap applies ${saved} before hydration`).toBe(
				expected
			);
			await expectTheme(page, expected);
			expect(await page.evaluate(() => localStorage.getItem('seorii-theme-system'))).toBe(system);
			if (saved === 'not-a-theme') {
				await page.emulateMedia({ colorScheme: 'light' });
				await expectTheme(page, 'light');
			}
		}
	}
});

test('both artifacts remain usable when storage reads and writes throw', async ({
	page,
	context
}) => {
	test.setTimeout(60_000);
	await page.addInitScript(() => {
		for (const method of ['getItem', 'setItem']) {
			Object.defineProperty(Storage.prototype, method, {
				configurable: true,
				value() {
					throw new DOMException('Storage is blocked for this test', 'SecurityError');
				}
			});
		}
	});
	for (const target of ['production', 'standalone'] as const) {
		await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
		await openTarget(page, context, target);
		await expectTheme(page, 'dark');
		await page.getByRole('button', { name: '다크 모드', exact: true }).click();
		await expectTheme(page, 'light');
		await page.emulateMedia({ colorScheme: 'light' });
		await expectTheme(page, 'light');
		await page.emulateMedia({ colorScheme: 'dark' });
		await expectTheme(page, 'dark');
		await page.getByRole('button', { name: '다크 모드', exact: true }).click();
		await expectTheme(page, 'light');
		await expect(page.locator('.snow-background')).toHaveAttribute('data-paused', 'true');
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
	}
});

test('320px headers keep a single 44px keyboard toggle in Korean and English', async ({
	page,
	context
}) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 320, height: 740 });
	await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
	for (const target of ['production', 'standalone'] as const) {
		await openTarget(page, context, target);
		for (const language of ['ko', 'en'] as const) {
			await page.getByRole('button', { name: language === 'ko' ? '한국어' : 'English' }).click();
			await expectTheme(page, 'light', language);
			const button = page.locator('header .theme-toggle');
			const bounds = await button.boundingBox();
			expect(bounds).not.toBeNull();
			expect(bounds!.width).toBe(44);
			expect(bounds!.height).toBe(44);
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
			const wordmark = await page.locator('header .wordmark').boundingBox();
			const controls = await page.locator('.header-controls').boundingBox();
			expect(wordmark!.x + wordmark!.width).toBeLessThanOrEqual(controls!.x);
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
				320
			);
			await page.getByRole('button', { name: 'English', exact: true }).focus();
			await page.keyboard.press('Tab');
			await expect(button).toBeFocused();
			await expect(button).toHaveCSS('outline-style', 'solid');
			await page.keyboard.press('Enter');
			await expectTheme(page, 'dark', language);
			await page.keyboard.press('Space');
			await expectTheme(page, 'light', language);
			await expect(button).toBeFocused();
		}
	}
});
