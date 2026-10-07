import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkRateLimit, rateLimitResponse } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	if (!(await checkRateLimit(supabase, `like:toggle:${user.id}`, { windowSeconds: 60, max: 60 }))) {
		return rateLimitResponse();
	}

	const { data: existing } = await supabase
		.from('comment_likes')
		.select('id')
		.eq('comment_id', params.id)
		.eq('user_id', user.id)
		.maybeSingle();

	if (existing) {
		await supabase.from('comment_likes').delete().eq('id', existing.id);
	} else {
		await supabase.from('comment_likes').insert({ comment_id: params.id, user_id: user.id });
	}

	const { count } = await supabase
		.from('comment_likes')
		.select('*', { count: 'exact', head: true })
		.eq('comment_id', params.id);

	return json({ liked: !existing, count: count ?? 0 });
};
