// Integration tests: the Postgres-backed rate limiter, exercised against the
// real check_rate_limit function (see the migration in the PR description —
// no mocking the database here, since the whole point is proving the atomic
// increment-and-check actually works under a real connection).

import { describe, it, expect } from 'vitest';
import { configured, admin } from './helpers';
import { checkRateLimit } from '../../src/lib/server/rateLimit';

function uniqueKey(label: string) {
	return `test:${label}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe.skipIf(!configured)('rate limiting (integration)', () => {
	it('allows requests while under the limit', async () => {
		const key = uniqueKey('under-limit');
		for (let i = 0; i < 3; i++) {
			const allowed = await checkRateLimit(admin, key, { windowSeconds: 60, max: 5 });
			expect(allowed).toBe(true);
		}
	});

	it('blocks requests once the limit is exceeded within the same window', async () => {
		const key = uniqueKey('over-limit');
		const results: boolean[] = [];
		for (let i = 0; i < 4; i++) {
			results.push(await checkRateLimit(admin, key, { windowSeconds: 60, max: 3 }));
		}
		expect(results).toEqual([true, true, true, false]);
	});

	it('scopes limits per key, so one actor hitting their limit does not affect another', async () => {
		const keyA = uniqueKey('actor-a');
		const keyB = uniqueKey('actor-b');
		for (let i = 0; i < 2; i++) await checkRateLimit(admin, keyA, { windowSeconds: 60, max: 2 });
		const aNowBlocked = await checkRateLimit(admin, keyA, { windowSeconds: 60, max: 2 });
		const bStillAllowed = await checkRateLimit(admin, keyB, { windowSeconds: 60, max: 2 });
		expect(aNowBlocked).toBe(false);
		expect(bStillAllowed).toBe(true);
	});
});
