import type { SupabaseClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';

// Fixed-window rate limiter backed by Postgres (see check_rate_limit in the
// migration). `key` should scope the limit to one actor and one action, e.g.
// `post:create:<user_id>`, so different users and different actions don't
// share a bucket.
export async function checkRateLimit(
	supabase: SupabaseClient,
	key: string,
	opts: { windowSeconds: number; max: number }
): Promise<boolean> {
	const { data, error } = await supabase.rpc('check_rate_limit', {
		p_key: key,
		p_window_seconds: opts.windowSeconds,
		p_max: opts.max
	});
	if (error) {
		// Fail open: a rate-limiter outage shouldn't be able to take down
		// every write in the app. Worst case here is a missed throttle, not
		// an outage — an acceptable tradeoff for abuse-prevention rather than
		// a hard security boundary.
		console.error('rate limit check failed', error);
		return true;
	}
	return data === true;
}

export function rateLimitResponse() {
	return json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
}
