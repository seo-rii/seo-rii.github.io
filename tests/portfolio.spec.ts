import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

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
	expect(browserErrors.get(page), 'No runtime or hydration errors').toEqual([]);
});

async function expectSnowReady(page: Page) {
	await expect(page.locator('.snow-background')).toHaveAttribute('data-ready', 'true');
	await expect(page.locator('.snow-host canvas')).toBeVisible();
}

async function expectSnowAmount(page: Page, amount: '1' | '0.16') {
	await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', amount);
	// The engine's text output reflects its setting exactly. Its range input has
	// step=10, so Chromium rounds a 16% setting to 20 on that hidden slider.
	await expect(page.locator('.snow-host [data-control="snowAmount-value"]')).toHaveText(
		amount === '1' ? '100%' : '16%'
	);
}

async function canvasHash(page: Page) {
	return page.locator('.snow-host canvas').evaluate((element) => {
		const canvas = element as HTMLCanvasElement;
		const context = canvas.getContext('2d');
		if (!context || !canvas.width || !canvas.height) throw new Error('Snow canvas is not ready');
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
		let hash = 2166136261;
		for (let i = 0; i < pixels.length; i += 97) hash = Math.imul(hash ^ pixels[i], 16777619);
		return `${canvas.width}x${canvas.height}:${hash >>> 0}`;
	});
}

async function expectSnowFrozen(page: Page) {
	// Allow resize observers and the final paused frame to settle first.
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	const frame = await canvasHash(page);
	await page.waitForTimeout(350);
	expect(await canvasHash(page), 'Paused canvas stays unchanged across several 12fps frames').toBe(
		frame
	);
}

async function expectNoHorizontalOverflow(page: Page) {
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
		.toBeLessThanOrEqual(0);
}

test('desktop has accessible structure, social links and persistent Korean/English selection', async ({
	page
}) => {
	await page.goto('/');
	await expectSnowReady(page);
	await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
	await expect(page.getByRole('main')).toHaveCount(1);
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	await expect(page.getByRole('banner').getByRole('navigation')).toHaveCount(0);
	await expect(page.getByText('A FEW THINGS ABOUT ME')).toHaveCount(0);
	await expect(page.getByText('A SMALL MARK, MY OWN.')).toHaveCount(0);
	await expect(page.getByRole('link', { name: '아래로', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toContainText('어떤 것을 만듭니다.');
	await expect(page.getByRole('button', { name: '한국어', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
		'href',
		'https://linkedin.com/in/seorii'
	);

	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('link', { name: 'Scroll down', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toContainText('I make things');
	await expect(page.getByRole('heading', { name: "Where I've been", exact: true })).toBeVisible();
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.getByRole('button', { name: '한국어', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
	await expect(page.getByRole('heading', { name: '다닌 곳', exact: true })).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test('leaving the top reduces snow, the hero symbol scrolls away, and section anchors work', async ({
	page
}) => {
	await page.goto('/');
	await expectSnowReady(page);
	await expectSnowAmount(page, '1');
	await expect(page.locator('.snow-host [data-control="scrollMode"]')).toHaveValue('camera');
	await expect(page.getByRole('img', { name: 'seorii 눈송이 심볼' })).toBeInViewport();

	await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' }));
	await expectSnowAmount(page, '0.16');
	await page.evaluate(() =>
		window.scrollTo({ top: window.innerHeight + 100, behavior: 'instant' })
	);
	await expectSnowAmount(page, '0.16');
	await expect(page.locator('.hero-symbol img')).not.toBeInViewport();
	await expect(page.locator('.snow-background')).toHaveCSS('position', 'fixed');

	await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
	await expectSnowAmount(page, '1');
	await expect(page.locator('.hero-symbol img')).toBeInViewport();
	await page.getByRole('link', { name: /만든 것 둘러보기/ }).click();
	await expect(page).toHaveURL(/#projects$/);
	await expect(page.locator('#projects h2')).toBeInViewport();
	await expectSnowAmount(page, '0.16');
	for (const id of ['about', 'projects', 'opensource', 'awards']) {
		await expect(page.locator(`section#${id}`)).toHaveCount(1);
	}
	await page.locator('.back-top').click();
	await expect(page).toHaveURL(/#top$/);
	await expectSnowAmount(page, '1');
});

test('pause freezes the actual canvas and resume restarts animation', async ({ page }) => {
	await page.goto('/');
	await expectSnowReady(page);
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
	await page.getByRole('button', { name: /눈 잠시 멈추기/ }).click();
	await expect(page.locator('.snow-toggle')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
	await expectSnowFrozen(page);
	const pausedFrame = await canvasHash(page);
	await page.getByRole('button', { name: /눈 다시 내리기/ }).click();
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
	await expect.poll(() => canvasHash(page)).not.toBe(pausedFrame);
});

test('reduced motion starts still and preference changes preserve an explicit pause', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await expectSnowReady(page);
	await expect(page.locator('.snow-background')).toHaveAttribute('data-paused', 'true');
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
	await expectSnowFrozen(page);

	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
	await page.getByRole('button', { name: /눈 잠시 멈추기/ }).click();
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await expect(page.locator('.snow-toggle')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
	await expectSnowFrozen(page);
	await page.getByRole('button', { name: /눈 다시 내리기/ }).click();
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
});

for (const width of [320, 390]) {
	test(`mobile ${width}px keeps both languages and all social links readable without horizontal scrolling`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await page.goto('/');
		await expectSnowReady(page);
		for (const language of ['한국어', 'English']) {
			await page.getByRole('button', { name: language, exact: true }).click();
			await expectNoHorizontalOverflow(page);
			const links = page.locator('.social-links a');
			await expect(links).toHaveCount(4);
			for (const link of await links.all()) {
				await link.scrollIntoViewIfNeeded();
				await expect(link).toBeInViewport();
			}
			await page.locator('#projects h2').scrollIntoViewIfNeeded();
			await expectNoHorizontalOverflow(page);
			await expectSnowAmount(page, '0.16');
		}
	});
}

test('standalone HTML works from file:// offline without external scripts, fonts or images', async ({
	page,
	context
}) => {
	const externalRequests: string[] = [];
	page.on('request', (request) => {
		if (/^https?:/.test(request.url())) {
			externalRequests.push(`${request.resourceType()}: ${request.url()}`);
		}
	});
	await page.route(/^https?:\/\//, (route) => route.abort());
	await context.setOffline(true);
	await page.goto(pathToFileURL(resolve('review/seorii-preview.html')).href);
	await expectSnowReady(page);
	await expectSnowAmount(page, '1');
	await expect(page.getByRole('banner').getByRole('navigation')).toHaveCount(0);
	await expect(page.getByText('A FEW THINGS ABOUT ME')).toHaveCount(0);
	await expect(page.getByText('A SMALL MARK, MY OWN.')).toHaveCount(0);
	await expect(page.locator('.snow-host [data-control="scrollMode"]')).toHaveValue('camera');
	await expect(page.locator('.hero-symbol img')).toHaveAttribute('src', /^data:image\//);
	await expect
		.poll(() =>
			page.locator('.hero-symbol img').evaluate((image) => (image as HTMLImageElement).naturalWidth)
		)
		.toBeGreaterThan(0);

	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('I make things');
	await expect(page.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
		'href',
		'https://linkedin.com/in/seorii'
	);
	await page.getByRole('button', { name: /Pause snow/ }).click();
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
	await expectSnowFrozen(page);
	await page.getByRole('button', { name: /Resume snow/ }).click();
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
	await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' }));
	await expectSnowAmount(page, '0.16');
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
	await expectSnowAmount(page, '1');
	await page.getByRole('button', { name: '한국어', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
	expect(externalRequests, 'A single-file review must not request any HTTP resources').toEqual([]);
});
