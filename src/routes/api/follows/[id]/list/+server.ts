import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, locals: { supabase } }) => {
	const type = url.searchParams.get('type'); // 'followers' | 'following'

	if (type === 'followers') {
		// People who follow params.id
		const { data: rows } = await supabase
			.from('follows')
			.select('follower_id')
			.eq('following_id', params.id);
		const ids = (rows ?? []).map((r: any) => r.follower_id);
		if (!ids.length) return json([]);
		const { data: profiles } = await supabase
			.from('profiles')
			.select('id, full_name, avatar_url')
			.in('id', ids);
		return json(profiles ?? []);
	} else {
		// People that params.id follows
		const { data: rows } = await supabase
			.from('follows')
			.select('following_id')
			.eq('follower_id', params.id);
		const ids = (rows ?? []).map((r: any) => r.following_id);
		if (!ids.length) return json([]);
		const { data: profiles } = await supabase
			.from('profiles')
			.select('id, full_name, avatar_url')
			.in('id', ids);
		return json(profiles ?? []);
	}
};
