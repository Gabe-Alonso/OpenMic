import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const includeFollowers = url.searchParams.get('include_followers') === 'true';

	const { data: followingRows } = await supabase
		.from('follows')
		.select('following_id')
		.eq('follower_id', user.id);

	const targetIds = new Set((followingRows ?? []).map((r) => r.following_id));

	if (includeFollowers) {
		const { data: followerRows } = await supabase
			.from('follows')
			.select('follower_id')
			.eq('following_id', user.id);
		for (const r of followerRows ?? []) targetIds.add(r.follower_id);
	}

	if (targetIds.size === 0) {
		return json({ posts: [], likeCounts: {} });
	}

	const { data: posts } = await supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url)')
		.in('author_id', [...targetIds])
		.order('created_at', { ascending: false })
		.limit(100);

	const postsData = posts ?? [];
	const likeCounts: Record<string, number> = {};

	if (postsData.length > 0) {
		const { data: likes } = await supabase
			.from('post_likes')
			.select('post_id')
			.in('post_id', postsData.map((p) => p.id));
		for (const like of likes ?? []) {
			likeCounts[like.post_id] = (likeCounts[like.post_id] ?? 0) + 1;
		}
	}

	return json({ posts: postsData, likeCounts });
};
