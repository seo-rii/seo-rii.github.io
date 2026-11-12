import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Compile the same component used by the real route. IIFE output works with
// file:// and library mode embeds imported images instead of fetching assets.
const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
	root,
	configFile: false,
	publicDir: false,
	plugins: [svelte({ configFile: false })],
	build: {
		write: false,
		minify: true,
		cssCodeSplit: false,
		lib: {
			entry: fileURLToPath(new URL('./review-entry.ts', import.meta.url)),
			name: 'SeoriiReview',
			formats: ['iife']
		}
	}
});

const bundles = Array.isArray(result) ? result : [result];
const output = bundles.flatMap((bundle) => {
	if (!('output' in bundle)) throw new Error('Expected a non-watching Vite build');
	return bundle.output;
});
const scripts = output.filter((item) => item.type === 'chunk');
const styles = output
	.filter((item) => item.type === 'asset')
	.filter((item) => item.fileName.endsWith('.css'));
const extra = output.filter((item) => item.type === 'asset' && !item.fileName.endsWith('.css'));
if (scripts.length !== 1 || extra.length !== 0) {
	throw new Error('Review must contain exactly one script and no external assets');
}
const javascript = scripts[0].code.replace(/<\/script/gi, '<\\/script');
const css = styles
	.map((item) => item.source)
	.join('\n')
	.replace(/<\/style/gi, '<\\/style');
const favicon = (await readFile(new URL('../static/favicon.ico', import.meta.url))).toString(
	'base64'
);
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:image/x-icon;base64,${favicon}">
<title>이서현 · seorii</title>
<style>${css}</style>
</head>
<body>
<div id="portfolio"></div>
<noscript>이 미리보기를 보려면 JavaScript를 켜 주세요. Enable JavaScript to view this preview.</noscript>
<script>${javascript}</script>
</body>
</html>
`;
await mkdir(new URL('../review/', import.meta.url), { recursive: true });
await writeFile(new URL('../review/seorii-preview.html', import.meta.url), html);
console.log(
	`review/seorii-preview.html — ${Math.round(Buffer.byteLength(html) / 1024)} KiB, no external assets`
);
