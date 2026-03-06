import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: post } = await supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url, location)')
		.eq('id', params.id)
		.single();

	if (!post) throw error(404, 'Post not found');

	const [{ count: likeCount }, likerRes, likedRes] = await Promise.all([
		supabase
			.from('post_likes')
			.select('*', { count: 'exact', head: true })
			.eq('post_id', params.id),
		supabase
			.from('post_likes')
			.select('user_id, profiles(id, full_name, avatar_url)')
			.eq('post_id', params.id)
			.order('created_at', { ascending: false })
			.limit(50),
		user
			? supabase
					.from('post_likes')
					.select('id')
					.eq('post_id', params.id)
					.eq('user_id', user.id)
					.maybeSingle()
			: Promise.resolve({ data: null })
	]);

	return {
		post,
		likeCount: likeCount ?? 0,
		userLiked: !!likedRes.data,
		likers: likerRes.data ?? []
	};
};
