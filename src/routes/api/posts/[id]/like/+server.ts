import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { data: existing } = await supabase
		.from('post_likes')
		.select('id')
		.eq('post_id', params.id)
		.eq('user_id', user.id)
		.maybeSingle();

	if (existing) {
		await supabase.from('post_likes').delete().eq('id', existing.id);
	} else {
		await supabase.from('post_likes').insert({ post_id: params.id, user_id: user.id });
	}

	const { count } = await supabase
		.from('post_likes')
		.select('*', { count: 'exact', head: true })
		.eq('post_id', params.id);

	return json({ liked: !existing, count: count ?? 0 });
};
