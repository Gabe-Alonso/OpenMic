import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (user.id === params.id) return json({ error: 'Cannot follow yourself' }, { status: 400 });

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
	}

	const { count } = await supabase
		.from('follows')
		.select('*', { count: 'exact', head: true })
		.eq('following_id', params.id);

	return json({ following: !existing, followerCount: count ?? 0 });
};
