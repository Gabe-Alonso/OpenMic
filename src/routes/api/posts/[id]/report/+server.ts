import { json } from '@sveltejs/kit';
import { logger } from '@sentry/sveltekit';
import type { RequestHandler } from './$types';
import { checkRateLimit, rateLimitResponse } from '$lib/server/rateLimit';

const VALID_REASONS = ['spam', 'harassment', 'inappropriate', 'other'];

export const POST: RequestHandler = async ({ params, request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	if (!(await checkRateLimit(supabase, `report:create:${user.id}`, { windowSeconds: 3600, max: 10 }))) {
		return rateLimitResponse();
	}

	const { reason, details } = await request.json();
	if (!VALID_REASONS.includes(reason)) {
		return json({ error: 'Invalid reason' }, { status: 400 });
	}

	const { data: post } = await supabase.from('posts').select('author_id').eq('id', params.id).maybeSingle();
	if (!post) return json({ error: 'Post not found' }, { status: 404 });
	if (post.author_id === user.id) return json({ error: 'You cannot report your own post' }, { status: 400 });

	const { error: insertErr } = await supabase.from('reports').insert({
		post_id: params.id,
		reporter_id: user.id,
		reason,
		details: typeof details === 'string' ? details.slice(0, 1000) : null
	});

	if (insertErr) {
		// Unique violation on (post_id, reporter_id): they already reported this post.
		if (insertErr.code === '23505') return json({ ok: true, alreadyReported: true });
		return json({ error: insertErr.message }, { status: 500 });
	}

	logger.info('post reported', { postId: params.id, reporterId: user.id, reason });

	return json({ ok: true, alreadyReported: false });
};
