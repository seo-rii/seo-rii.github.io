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

async function expectSnowAmount(page: Page, amount: '1' | '0.25') {
	await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', amount);
	// The engine's text output reflects its setting exactly. Its range input has
	// step=10, so the hidden range input can round an intermediate percentage.
	await expect(page.locator('.snow-host [data-control="snowAmount-value"]')).toHaveText(
		amount === '1' ? '100%' : '25%'
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

async function expectColorScheme(page: Page, scheme: 'light' | 'dark') {
	const colors =
		scheme === 'dark'
			? { background: '#101923', snow: '#e5eff8', wash: '#355c80', rgb: 'rgb(16, 25, 35)' }
			: { background: '#ffffff', snow: '#090e13', wash: '#4f87ad', rgb: 'rgb(255, 255, 255)' };
	await expect(page.locator('html')).toHaveCSS('background-color', colors.rgb);
	expect(
		await page.locator('html').evaluate((root) => getComputedStyle(root).colorScheme.split(/\s+/))
	).toContain(scheme);
	await expect(page.locator('.snow-host')).toHaveAttribute('data-theme', scheme);
	for (const [control, value] of [
		['backgroundColor', colors.background],
		['snowColor', colors.snow],
		['washColor', colors.wash]
	]) {
		await expect(page.locator(`.snow-host [data-control="${control}"]`)).toHaveValue(value);
	}
	const themeColor = await page.locator('meta[name="theme-color"]').evaluateAll((elements) => {
		const active = elements.find((element) => {
			const media = element.getAttribute('media');
			return !media || matchMedia(media).matches;
		});
		const color = active?.getAttribute('content')?.toLowerCase();
		return color?.length === 4
			? `#${[...color.slice(1)].map((digit) => digit + digit).join('')}`
			: color;
	});
	expect(themeColor, 'Browser chrome follows the active site color scheme').toBe(colors.background);

	const contrast = await page.evaluate(() => {
		const luminance = (color: string) => {
			const rgb = color
				.match(/[\d.]+/g)
				?.slice(0, 3)
				.map(Number);
			if (!rgb || rgb.length !== 3) throw new Error(`Expected an RGB color: ${color}`);
			const linear = rgb.map((value) => {
				const channel = value / 255;
				return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
			});
			return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
		};
		const background = luminance(getComputedStyle(document.documentElement).backgroundColor);
		return ['h1', '.prose', '.prose a', '.social-detail'].map((selector) => {
			const element = document.querySelector(selector);
			if (!element) throw new Error(`Missing readable content: ${selector}`);
			const text = luminance(getComputedStyle(element).color);
			return {
				selector,
				ratio: (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)
			};
		});
	});
	for (const { selector, ratio } of contrast) {
		expect(
			ratio,
			`${selector} stays readable against the page base in ${scheme} mode`
		).toBeGreaterThanOrEqual(4.5);
	}
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
	await expect(page.locator('.snow-host [data-control="scrollBlur"]')).toHaveValue('0');
	await expect(page.getByRole('img', { name: 'seorii 눈송이 심볼' })).toBeInViewport();

	await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' }));
	await expectSnowAmount(page, '0.25');
	await page.evaluate(() =>
		window.scrollTo({ top: window.innerHeight + 100, behavior: 'instant' })
	);
	await expectSnowAmount(page, '0.25');
	await expect(page.locator('.hero-symbol img')).not.toBeInViewport();
	await expect
		.poll(() =>
			page.locator('.snow-host canvas').evaluate((canvas) => {
				const box = canvas.getBoundingClientRect();
				return (
					box.left <= 0.01 &&
					box.right >= innerWidth - 0.01 &&
					box.top <= 0.01 &&
					box.bottom >= innerHeight - 0.01
				);
			})
		)
		.toBe(true);

	await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
	await expectSnowAmount(page, '1');
	await expect(page.locator('.hero-symbol img')).toBeInViewport();
	await page.getByRole('link', { name: /만든 것 둘러보기/ }).click();
	await expect(page).toHaveURL(/#projects$/);
	await expect(page.locator('#projects h2')).toBeInViewport();
	await expectSnowAmount(page, '0.25');
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
		// Dedicated tests cover animation; keep these layout measurements still.
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.setViewportSize({ width, height: 844 });
		await page.goto('/');
		await expectSnowReady(page);
		for (const language of ['한국어', 'English']) {
			await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
			await page.getByRole('button', { name: language, exact: true }).click();
			await expectNoHorizontalOverflow(page);
			const workLink = await page.locator('.work-link').boundingBox();
			const socialLinks = await page.locator('.social-links').boundingBox();
			expect(workLink).not.toBeNull();
			expect(socialLinks).not.toBeNull();
			const gap = socialLinks!.y - (workLink!.y + workLink!.height);
			expect(
				gap,
				'Mobile profile links follow the introduction without a large empty gap'
			).toBeGreaterThanOrEqual(0);
			expect(
				gap,
				'Mobile profile links follow the introduction without a large empty gap'
			).toBeLessThanOrEqual(100);
			const links = page.locator('.social-links a');
			await expect(links).toHaveCount(4);
			for (const link of await links.all()) {
				await link.scrollIntoViewIfNeeded();
				await expect(link).toBeInViewport();
			}
			await page.locator('#projects h2').scrollIntoViewIfNeeded();
			await expectNoHorizontalOverflow(page);
			await expectSnowAmount(page, '0.25');
		}
	});
}

test.describe('mobile snow viewport', () => {
	test.use({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
		reducedMotion: 'reduce'
	});

	for (const target of ['production', 'standalone'] as const) {
		test(`${target} keeps the snow backing store fixed while the clipping aperture changes`, async ({
			page
		}) => {
			test.setTimeout(60_000);
			await page.goto(
				target === 'production' ? '/' : pathToFileURL(resolve('review/seorii-preview.html')).href
			);
			await expectSnowReady(page);
			await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
			await expectSnowFrozen(page);
			expect(await page.evaluate(() => document.visibilityState)).toBe('visible');

			type TrackedCanvas = HTMLCanvasElement & {
				__snowSizeWrites?: number;
				__snowResizeObserver?: MutationObserver;
			};
			const canvas = page.locator('.snow-host canvas');
			const wrapper = page.locator('.snow-background');
			await canvas.evaluate((element) => {
				const tracked = element as TrackedCanvas;
				tracked.__snowSizeWrites = 0;
				tracked.__snowResizeObserver = new MutationObserver((records) => {
					tracked.__snowSizeWrites! += records.length;
				});
				tracked.__snowResizeObserver.observe(tracked, {
					attributes: true,
					attributeFilter: ['width', 'height']
				});
			});
			const initialSize = await canvas.evaluate((element) => {
				const target = element as HTMLCanvasElement;
				return { width: target.width, height: target.height };
			});

			// Headless Chromium has no collapsing address bar. Vary only the clip
			// aperture, keeping the device viewport fixed, to verify the same sizing contract.
			for (const height of [690, 760, 660, 844]) {
				await wrapper.evaluate((element, height) => {
					(element as HTMLElement).style.height = `${height}px`;
					window.dispatchEvent(new Event('resize'));
					window.visualViewport?.dispatchEvent(new Event('resize'));
				}, height);
				await page.evaluate(
					() =>
						new Promise<void>((resolve) =>
							requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
						)
				);
				await expect(wrapper).toHaveCSS('overflow', 'clip');
				const clippingBox = await wrapper.boundingBox();
				expect(clippingBox?.height).toBe(height);
				const drawingBox = await canvas.boundingBox();
				expect(drawingBox).not.toBeNull();
				expect(drawingBox!.y).toBeLessThanOrEqual(clippingBox!.y);
				expect(drawingBox!.y + drawingBox!.height).toBeGreaterThanOrEqual(
					clippingBox!.y + clippingBox!.height
				);
				const current = await canvas.evaluate((element) => {
					const tracked = element as TrackedCanvas;
					return {
						size: { width: tracked.width, height: tracked.height },
						writes: tracked.__snowSizeWrites ?? 0
					};
				});
				expect(current.size, `Clipping to ${height}px must not resize the rendered scene`).toEqual(
					initialSize
				);
				expect(
					current.writes,
					'Viewport clipping must not reallocate the canvas backing store'
				).toBe(0);
			}

			await wrapper.evaluate((element) => (element as HTMLElement).style.removeProperty('height'));
			// Model an open mobile toolbar: the visible viewport shrinks while the
			// device's maximum drawing height remains unchanged. The sticky holder
			// must use the visible height, independently of the 100lvh render box.
			const drawingViewport = page.locator('.snow-viewport');
			await drawingViewport.evaluate((element) => {
				(element as HTMLElement).style.height = '844px';
			});
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.setViewportSize({ width: 390, height: 690 });
			await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
			await expect(page.locator('.snow-surface')).toHaveCSS('height', '690px');
			await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }));
			await expectSnowAmount(page, '0.25');
			await expect
				.poll(() =>
					page.locator('.snow-anchor').evaluate((element) => {
						return parseFloat((element as HTMLElement).style.height) === window.scrollY;
					})
				)
				.toBe(true);
			const transported = await canvas.evaluate((element) => {
				const tracked = element as TrackedCanvas;
				const before = tracked.getBoundingClientRect().y;
				// Both measurements run before another engine capture can occur.
				window.scrollBy({ top: 8, behavior: 'instant' });
				return {
					movement: tracked.getBoundingClientRect().y - before,
					size: { width: tracked.width, height: tracked.height },
					writes: tracked.__snowSizeWrites ?? 0
				};
			});
			expect(
				transported.movement,
				'Toolbar visibility does not disable native buffer movement'
			).toBeCloseTo(-8, 4);
			expect(transported.size).toEqual(initialSize);
			expect(transported.writes, 'Toolbar visibility does not reallocate the drawing surface').toBe(
				0
			);
			await drawingViewport.evaluate((element) =>
				(element as HTMLElement).style.removeProperty('height')
			);
			await page.setViewportSize({ width: 844, height: 390 });
			await expect
				.poll(() =>
					canvas.evaluate((element) => {
						const target = element as HTMLCanvasElement;
						return { width: target.width, height: target.height };
					})
				)
				.not.toEqual(initialSize);
			await expect
				.poll(() => canvas.evaluate((element) => (element as TrackedCanvas).__snowSizeWrites ?? 0))
				.toBeGreaterThan(0);
			const coverage = await canvas.boundingBox();
			expect(coverage).not.toBeNull();
			expect(coverage!.x).toBe(0);
			expect(coverage!.y).toBeLessThanOrEqual(0);
			expect(coverage!.width).toBe(844);
			expect(coverage!.y + coverage!.height).toBeGreaterThanOrEqual(390);
			await expectNoHorizontalOverflow(page);
			await canvas.evaluate((element) =>
				(element as TrackedCanvas).__snowResizeObserver?.disconnect()
			);
		});
	}
});

test.describe('system color scheme', () => {
	test.use({ reducedMotion: 'reduce' });

	for (const target of ['production', 'standalone'] as const) {
		test(`${target} follows dark and light preferences without remounting or resuming paused snow`, async ({
			page,
			context
		}) => {
			test.setTimeout(60_000);
			if (target === 'standalone') {
				await page.setViewportSize({ width: 390, height: 844 });
				await context.setOffline(true);
			}
			await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
			await page.goto(
				target === 'production' ? '/' : pathToFileURL(resolve('review/seorii-preview.html')).href
			);
			await expectSnowReady(page);
			await expectColorScheme(page, 'dark');
			await expect(page.locator('.hero-symbol img')).toBeVisible();
			await expect(page.getByRole('link', { name: /LinkedIn/ })).toBeVisible();
			await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
			const canvas = page.locator('.snow-host canvas');
			await canvas.evaluate((element) => element.setAttribute('data-theme-sentinel', 'preserved'));
			const initialSize = await canvas.evaluate((element) => {
				const surface = element as HTMLCanvasElement;
				return { width: surface.width, height: surface.height };
			});
			await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' }));
			await expectSnowAmount(page, '0.25');

			await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
			await expectColorScheme(page, 'light');
			await expectSnowAmount(page, '0.25');
			await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
			await expectSnowFrozen(page);

			await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
			await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'true');
			await page.getByRole('button', { name: /눈 잠시 멈추기/ }).click();
			await expect(page.locator('.snow-toggle')).toHaveAttribute('aria-pressed', 'true');
			await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
			await expectColorScheme(page, 'dark');
			await expectSnowAmount(page, '0.25');
			await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
			await expectSnowFrozen(page);
			await expect(canvas).toHaveAttribute('data-theme-sentinel', 'preserved');
			expect(
				await canvas.evaluate((element) => {
					const surface = element as HTMLCanvasElement;
					return { width: surface.width, height: surface.height };
				})
			).toEqual(initialSize);
			await expectNoHorizontalOverflow(page);
		});
	}
});

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
	await expect(page.locator('.snow-host [data-control="scrollBlur"]')).toHaveValue('0');
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
	await expectSnowAmount(page, '0.25');
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
	await expectSnowAmount(page, '1');
	await page.getByRole('button', { name: '한국어', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
	expect(externalRequests, 'A single-file review must not request any HTTP resources').toEqual([]);
});
