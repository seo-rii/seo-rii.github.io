import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// This is a Chromium paint-mismatch regression, not a Samsung Internet device
// emulation. Browser darkening must not change the user's selected palette.
test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

async function expectTheme(page: Page, theme: 'light' | 'dark') {
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
	await expect(page.locator('.snow-background')).toHaveAttribute('data-ready', 'true');
	await expect(page.locator('.snow-host')).toHaveAttribute('data-theme', theme);
	const background = theme === 'dark' ? '#101923' : '#ffffff';
	await expect(page.locator('.snow-host [data-control="backgroundColor"]')).toHaveValue(background);
	await expect(page.locator('html')).toHaveCSS(
		'background-color',
		theme === 'dark' ? 'rgb(16, 25, 35)' : 'rgb(255, 255, 255)'
	);
	await expect(page.locator('.theme-toggle')).toHaveAttribute(
		'aria-pressed',
		theme === 'dark' ? 'true' : 'false'
	);
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
	expect(themeColor, 'Browser chrome follows the selected palette').toBe(background);
}

async function settlePaint(page: Page) {
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
}

async function analyzeSnapshots(page: Page, first: Buffer, second: Buffer, compareOnly = false) {
	return page.evaluate(
		async ({ first, second, compareOnly }) => {
			async function decode(base64: string) {
				const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
				const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
				const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
				const context = canvas.getContext('2d')!;
				context.drawImage(bitmap, 0, 0);
				bitmap.close();
				return context.getImageData(0, 0, canvas.width, canvas.height).data;
			}
			const foreground = await decode(first);
			const background = await decode(second);
			if (foreground.length !== background.length) throw new Error('Screenshot dimensions changed');
			let maximumDelta = 0;
			const counts = new Map<string, number>();
			for (let i = 0; i < foreground.length; i += 4) {
				const difference = Math.max(
					Math.abs(foreground[i] - background[i]),
					Math.abs(foreground[i + 1] - background[i + 1]),
					Math.abs(foreground[i + 2] - background[i + 2])
				);
				maximumDelta = Math.max(maximumDelta, difference);
				if (compareOnly || difference <= 12) continue;
				const key = `${foreground[i]},${foreground[i + 1]},${foreground[i + 2]}`;
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
			const dominant = [...counts].sort((a, b) => b[1] - a[1])[0];
			if (!dominant) return { ratio: 0, pixels: 0, maximumDelta };
			const color = dominant[0].split(',').map(Number);
			const luminance = (rgb: number[]) => {
				const channels = rgb.map((value) => {
					const channel = value / 255;
					return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
				});
				return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
			};
			const text = luminance(color);
			const ratios: number[] = [];
			for (let i = 0; i < foreground.length; i += 4) {
				if (
					foreground[i] !== color[0] ||
					foreground[i + 1] !== color[1] ||
					foreground[i + 2] !== color[2]
				)
					continue;
				const backdrop = luminance([background[i], background[i + 1], background[i + 2]]);
				ratios.push((Math.max(text, backdrop) + 0.05) / (Math.min(text, backdrop) + 0.05));
			}
			ratios.sort((a, b) => a - b);
			return { ratio: ratios[Math.floor(ratios.length / 2)], pixels: dominant[1], maximumDelta };
		},
		{ first: first.toString('base64'), second: second.toString('base64'), compareOnly }
	);
}

async function expectPaintedContrast(page: Page, selector: string) {
	// Computed colors do not expose browser paint transformations. Compare actual
	// glyph pixels with the same paused backdrop while the text is hidden.
	await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition', 'true');
	await settlePaint(page);
	const element = page.locator(selector);
	const bounds = await element.boundingBox();
	if (!bounds) throw new Error(`Missing visible text: ${selector}`);
	const viewport = page.viewportSize()!;
	const x = Math.max(0, Math.floor(bounds.x));
	const y = Math.max(0, Math.floor(bounds.y));
	const clip = {
		x,
		y,
		width: Math.min(viewport.width, Math.ceil(bounds.x + bounds.width)) - x,
		height: Math.min(viewport.height, Math.ceil(bounds.y + bounds.height)) - y
	};
	expect(clip.width).toBeGreaterThan(0);
	expect(clip.height).toBeGreaterThan(0);
	const shown = await page.screenshot({ clip, animations: 'disabled' });
	const previousStyle = await element.getAttribute('style');
	let hidden: Buffer;
	try {
		await element.evaluate((node) =>
			(node as HTMLElement).style.setProperty('visibility', 'hidden', 'important')
		);
		hidden = await page.screenshot({ clip, animations: 'disabled' });
	} finally {
		await element.evaluate((node, style) => {
			if (style === null) node.removeAttribute('style');
			else node.setAttribute('style', style);
		}, previousStyle);
	}
	const measured = await analyzeSnapshots(page, shown, hidden);
	expect(measured.pixels, `${selector} contains enough solid glyph pixels`).toBeGreaterThan(100);
	expect(measured.ratio, `${selector} stays readable in the rendered image`).toBeGreaterThanOrEqual(
		4.5
	);
}

async function canvasHash(page: Page) {
	return page.locator('.snow-host canvas').evaluate((node) => {
		const canvas = node as HTMLCanvasElement;
		const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
		let hash = 2166136261;
		for (let i = 0; i < pixels.length; i += 97) hash = Math.imul(hash ^ pixels[i], 16777619);
		return `${canvas.width}x${canvas.height}:${hash >>> 0}`;
	});
}

for (const target of ['production', 'standalone'] as const) {
	test(`${target} keeps light-theme text readable under Chromium forced dark painting`, async ({
		page,
		context
	}) => {
		const externalRequests: string[] = [];
		if (target === 'standalone') {
			page.on('request', (request) => {
				if (/^https?:/.test(request.url())) externalRequests.push(request.url());
			});
			await context.setOffline(true);
		}
		await page.emulateMedia({ colorScheme: 'light' });
		const session = await context.newCDPSession(page);
		await session.send('Emulation.setAutoDarkModeOverride', { enabled: true });
		await page.goto(
			target === 'production' ? '/' : pathToFileURL(resolve('review/seorii-preview.html')).href
		);
		await expectTheme(page, 'light');
		expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(
			false
		);
		await expectPaintedContrast(page, 'h1');
		await page.evaluate(() =>
			window.scrollTo({
				top: document.querySelector('#about')!.getBoundingClientRect().top + scrollY,
				behavior: 'instant'
			})
		);
		await expectPaintedContrast(page, '#about .prose');
		expect(externalRequests, 'The downloaded review embeds its resources').toEqual([]);
	});
}

test('forced painting preserves manual palette choices, paused canvas and scroll position', async ({
	page,
	context
}) => {
	await page.emulateMedia({ colorScheme: 'light' });
	const session = await context.newCDPSession(page);
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: false });
	await page.goto('/');
	await expectTheme(page, 'light');
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.getByRole('button', { name: /눈 잠시 멈추기/ }).click();
	await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
	await page.locator('.snow-host canvas').evaluate((canvas) => {
		canvas.setAttribute('data-identity-sentinel', 'preserved');
	});
	await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' }));
	await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
	// Asset restoration can present once after readiness; measure the held frame.
	await page.waitForTimeout(350);
	await settlePaint(page);
	const held = await canvasHash(page);
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: true });
	await settlePaint(page);
	await expectTheme(page, 'light');
	expect(await canvasHash(page), 'Browser painting does not repaint the source bitmap').toBe(held);
	expect(await page.evaluate(() => scrollY)).toBe(1);
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: false });
	await settlePaint(page);
	expect(await canvasHash(page)).toBe(held);
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: true });

	const expectPreserved = async (theme: 'light' | 'dark') => {
		await expectTheme(page, theme);
		await expect(page.locator('.snow-host canvas')).toHaveAttribute(
			'data-identity-sentinel',
			'preserved'
		);
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
		await expect(page.locator('.snow-toggle')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
	};
	// Pointer/keyboard activation is covered by theme-toggle.spec.ts. Dispatch
	// directly here so Playwright's locator preparation cannot scroll to the top.
	await page.locator('.theme-toggle').dispatchEvent('click');
	await expectPreserved('dark');
	await expectPaintedContrast(page, 'h1');
	await page.locator('.theme-toggle').dispatchEvent('click');
	await expectPreserved('light');
	await page.emulateMedia({ colorScheme: 'dark' });
	await expectPreserved('dark');
	await expectPaintedContrast(page, 'h1');
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: false });
	await expectPreserved('dark');
});

test('composition preserves the native light image and leaves the native dark palette unchanged', async ({
	page,
	context
}) => {
	await page.emulateMedia({ colorScheme: 'light' });
	const session = await context.newCDPSession(page);
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: false });
	await page.goto('/');
	await expectTheme(page, 'light');
	await page.waitForTimeout(350);
	await settlePaint(page);
	const composed = await page.screenshot({ animations: 'disabled' });
	const override = await page.addStyleTag({
		content: '.snow-surface { filter:none!important; mix-blend-mode:normal!important; }'
	});
	await settlePaint(page);
	const original = await page.screenshot({ animations: 'disabled' });
	const compared = await analyzeSnapshots(page, composed, original, true);
	expect(
		compared.maximumDelta,
		'Native light output differs by at most one rounding level'
	).toBeLessThanOrEqual(1);
	await override.evaluate((style) => style.remove());
	await page.emulateMedia({ colorScheme: 'dark' });
	await expectTheme(page, 'dark');
	await expect(page.locator('.snow-surface')).toHaveCSS('filter', 'none');
	await expect(page.locator('.snow-surface')).toHaveCSS('mix-blend-mode', 'normal');
	await expectPaintedContrast(page, 'h1');
});
