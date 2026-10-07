import { defineConfig, devices } from '@playwright/test';

// Set E2E_BASE_URL to run the tests against an already-deployed URL (for example a
// Vercel preview). Otherwise Playwright builds the app and serves it locally.
const externalUrl = process.env.E2E_BASE_URL;
const baseURL = externalUrl ?? 'http://localhost:4173';

export default defineConfig({
	testDir: 'e2e',
	timeout: 60_000,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		// Vercel preview URLs sit behind a login wall by default. This header, combined
		// with the bypass-cookie header, gets Playwright past it and keeps it past it for
		// the rest of the browser context. See: Vercel's "Protection Bypass for Automation".
		...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && {
			extraHTTPHeaders: {
				'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
				'x-vercel-set-bypass-cookie': 'true'
			}
		})
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	// CI serves the production build (what ships). Locally we use the dev server, because
	// the Vercel adapter's build step needs symlink permission that Windows often lacks.
	webServer: externalUrl
		? undefined
		: {
				command: process.env.CI
					? 'npm run build && npm run preview -- --port 4173 --strictPort'
					: 'npm run dev -- --port 4173 --strictPort',
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 180_000
			}
});
