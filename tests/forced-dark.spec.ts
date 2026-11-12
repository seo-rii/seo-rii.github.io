import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Chromium's automatic darkening reproduces the paint mismatch. It does not
// emulate Samsung Internet's proprietary darkening or replace a device check.
test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

async function expectScheme(page: Page, scheme: 'light' | 'dark') {
	await expect(page.locator('html')).toHaveAttribute('data-color-scheme', scheme);
	await expect(page.locator('.snow-background')).toHaveAttribute('data-ready', 'true');
	await expect(page.locator('.snow-host')).toHaveAttribute('data-theme', scheme);
	const background = scheme === 'dark' ? '#101923' : '#ffffff';
	await expect(page.locator('.snow-host [data-control="backgroundColor"]')).toHaveValue(background);
	await expect(page.locator('html')).toHaveCSS(
		'background-color',
		scheme === 'dark' ? 'rgb(16, 25, 35)' : 'rgb(255, 255, 255)'
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
	expect(themeColor, 'Browser chrome uses the effective theme, including forced dark').toBe(
		background
	);
}

async function expectPaintedContrast(page: Page, selector: string) {
	// Computed text colors can remain light-theme values while the browser paints
	// a different color. Measure actual screenshot pixels against the same frozen
	// backdrop with the text hidden, without storing a platform-specific snapshot.
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
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
	const measured = await page.evaluate(
		async ({ shown, hidden }) => {
			async function decode(base64: string) {
				const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
				const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
				const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
				const context = canvas.getContext('2d')!;
				context.drawImage(bitmap, 0, 0);
				bitmap.close();
				return context.getImageData(0, 0, canvas.width, canvas.height).data;
			}
			const foreground = await decode(shown);
			const background = await decode(hidden);
			const counts = new Map<string, number>();
			for (let i = 0; i < foreground.length; i += 4) {
				const difference = Math.max(
					Math.abs(foreground[i] - background[i]),
					Math.abs(foreground[i + 1] - background[i + 1]),
					Math.abs(foreground[i + 2] - background[i + 2])
				);
				if (difference <= 12) continue;
				const key = `${foreground[i]},${foreground[i + 1]},${foreground[i + 2]}`;
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
			const dominant = [...counts].sort((a, b) => b[1] - a[1])[0];
			if (!dominant) return { ratio: 0, pixels: 0 };
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
			return { ratio: ratios[Math.floor(ratios.length / 2)], pixels: dominant[1] };
		},
		{ shown: shown.toString('base64'), hidden: hidden.toString('base64') }
	);
	expect(
		measured.pixels,
		`${selector} has enough solid glyph pixels for the paint check`
	).toBeGreaterThan(100);
	expect(measured.ratio, `${selector} stays readable in the rendered image`).toBeGreaterThanOrEqual(
		4.5
	);
}

test('forced dark with a light media preference keeps the rendered heading and body readable', async ({
	page,
	context
}) => {
	await page.emulateMedia({ colorScheme: 'light' });
	const session = await context.newCDPSession(page);
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: true });
	await page.goto('/');
	await expectScheme(page, 'dark');
	expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
	await expectPaintedContrast(page, 'h1');
	await page.evaluate(() =>
		window.scrollTo({
			top: document.querySelector('#about')!.getBoundingClientRect().top + scrollY,
			behavior: 'instant'
		})
	);
	await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
	await expectPaintedContrast(page, '#about .prose');
});

test('native and forced theme changes preserve the canvas, manual pause and reading density', async ({
	page,
	context
}) => {
	await page.emulateMedia({ colorScheme: 'light' });
	const session = await context.newCDPSession(page);
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: false });
	await page.goto('/');
	await expectScheme(page, 'light');
	await page.locator('.snow-host canvas').evaluate((canvas) => {
		canvas.setAttribute('data-identity-sentinel', 'preserved');
	});
	await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' }));
	await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.getByRole('button', { name: /눈 잠시 멈추기/ }).click();
	await expect(page.locator('.snow-toggle')).toHaveAttribute('aria-pressed', 'true');

	const expectPreserved = async (scheme: 'light' | 'dark') => {
		await expectScheme(page, scheme);
		await expect(page.locator('.snow-host canvas')).toHaveAttribute(
			'data-identity-sentinel',
			'preserved'
		);
		await expect(page.locator('.snow-host')).toHaveAttribute('data-running', 'false');
		await expect(page.locator('.snow-toggle')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '0.25');
		await expect(page.locator('.snow-host [data-control="snowAmount-value"]')).toHaveText('25%');
	};
	await page.emulateMedia({ colorScheme: 'dark' });
	await expectPreserved('dark');
	await page.emulateMedia({ colorScheme: 'light' });
	await expectPreserved('light');
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: true });
	await expectPreserved('dark');
	expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: false });
	await expectPreserved('light');
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
	await expect(page.locator('.snow-background')).toHaveAttribute('data-snow-amount', '1');
});

test('offline standalone HTML follows forced dark and renders readable text', async ({
	page,
	context
}) => {
	const externalRequests: string[] = [];
	page.on('request', (request) => {
		if (/^https?:/.test(request.url())) externalRequests.push(request.url());
	});
	await context.setOffline(true);
	await page.emulateMedia({ colorScheme: 'light' });
	const session = await context.newCDPSession(page);
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: true });
	await page.goto(pathToFileURL(resolve('review/seorii-preview.html')).href);
	await expectScheme(page, 'dark');
	await expectPaintedContrast(page, 'h1');
	await session.send('Emulation.setAutoDarkModeOverride', { enabled: false });
	await expectScheme(page, 'light');
	await page.emulateMedia({ colorScheme: 'dark' });
	await expectScheme(page, 'dark');
	expect(externalRequests, 'The downloaded review keeps every resource embedded').toEqual([]);
});
