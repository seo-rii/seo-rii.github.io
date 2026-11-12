import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	workers: 1,
	timeout: 45_000,
	expect: { timeout: 10_000 },
	reporter: 'list',
	outputDir: 'test-results',
	use: {
		baseURL: 'http://127.0.0.1:41873',
		viewport: { width: 1440, height: 900 },
		locale: 'ko-KR',
		reducedMotion: 'no-preference',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
	webServer: {
		command: 'pnpm preview --host 127.0.0.1 --port 41873 --strictPort',
		url: 'http://127.0.0.1:41873',
		reuseExistingServer: false,
		timeout: 60_000
	}
});
