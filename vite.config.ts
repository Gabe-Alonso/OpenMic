import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => ({
	// sentrySvelteKit must come before sveltekit() in the plugins array.
	// It only uploads source maps when it finds a Sentry auth token
	// (SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT) in the environment —
	// without one, this is a no-op and the build is unaffected.
	plugins: [...(await sentrySvelteKit({ adapter: 'vercel' })), sveltekit()],
	test: {
		include: ['src/**/*.test.ts', 'tests/integration/**/*.test.ts'],
		environment: 'node',
		testTimeout: 30_000
	}
}));
