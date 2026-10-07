import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts', 'tests/integration/**/*.test.ts'],
		environment: 'node',
		testTimeout: 30_000
	}
});
