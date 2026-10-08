import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkRateLimit, rateLimitResponse } from '$lib/server/rateLimit';
import { notifyByEmail, newFollowerEmail } from '$lib/server/email';

export const POST: RequestHandler = async ({ params, url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (user.id === params.id) return json({ error: 'Cannot follow yourself' }, { status: 400 });

	if (!(await checkRateLimit(supabase, `follow:toggle:${user.id}`, { windowSeconds: 600, max: 30 }))) {
		return rateLimitResponse();
	}

	const { data: existing } = await supabase
		.from('follows')
		.select('id')
		.eq('follower_id', user.id)
		.eq('following_id', params.id)
		.maybeSingle();

	if (existing) {
		await supabase.from('follows').delete().eq('id', existing.id);
	} else {
		await supabase.from('follows').insert({ follower_id: user.id, following_id: params.id });

		const { data: followerProfile } = await supabase
			.from('profiles')
			.select('full_name')
			.eq('id', user.id)
			.maybeSingle();
		const { subject, html } = newFollowerEmail(followerProfile?.full_name ?? 'Someone', `${url.origin}/profile/${user.id}`);
		await notifyByEmail(params.id, subject, html);
	}

	const { count } = await supabase
		.from('follows')
		.select('*', { count: 'exact', head: true })
		.eq('following_id', params.id);

	return json({ following: !existing, followerCount: count ?? 0 });
};
