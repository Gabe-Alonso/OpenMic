import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { decodeCursor, applyCursor, paginateRows } from '$lib/server/pagination';

const PAGE_SIZE = 20;

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const includeFollowers = url.searchParams.get('include_followers') === 'true';
	const cursor = decodeCursor(url.searchParams.get('cursor'));

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
		return json({ posts: [], likeCounts: {}, nextCursor: null });
	}

	let postsQuery = supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url)')
		.in('author_id', [...targetIds])
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(PAGE_SIZE + 1);
	postsQuery = applyCursor(postsQuery, cursor);

	const { data: posts } = await postsQuery;
	const { page: postsData, nextCursor } = paginateRows(posts ?? [], PAGE_SIZE);
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

	return json({ posts: postsData, likeCounts, nextCursor });
};
