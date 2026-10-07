import type { PageServerLoad } from './$types';
import { paginateRows } from '$lib/server/pagination';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	let userHasLocation = false;
	if (user) {
		const { data: profile } = await supabase
			.from('profiles')
			.select('location_lat, location_lng')
			.eq('id', user.id)
			.single();
		userHasLocation = !!(profile?.location_lat && profile?.location_lng);
	}

	// Discover is "most engaged within a recent window," not "most engaged of
	// all time": ranking is computed per page, over whatever page of posts
	// keyset pagination hands back, rather than over the whole table. That
	// keeps the ranking meaningful (today's quiet post doesn't permanently
	// bury last month's lucky viral one) and keeps the query boundable —
	// ranking over the *entire* table would mean fetching the entire table.
	const { data: posts } = await supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url)')
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(PAGE_SIZE + 1);

	const { page: postsData, nextCursor } = paginateRows(posts ?? [], PAGE_SIZE);
	const likeCounts: Record<string, number> = {};
	const commentCounts: Record<string, number> = {};

	if (postsData.length > 0) {
		const ids = postsData.map((p) => p.id);
		const [{ data: likes }, { data: comments }] = await Promise.all([
			supabase.from('post_likes').select('post_id').in('post_id', ids),
			supabase.from('post_comments').select('post_id').in('post_id', ids)
		]);
		for (const like of likes ?? []) {
			likeCounts[like.post_id] = (likeCounts[like.post_id] ?? 0) + 1;
		}
		for (const comment of comments ?? []) {
			commentCounts[comment.post_id] = (commentCounts[comment.post_id] ?? 0) + 1;
		}
	}

	// Sort by engagement score (comments weighted 1.5x — takes more effort than a like)
	postsData.sort((a, b) => {
		const scoreA = (likeCounts[a.id] ?? 0) + (commentCounts[a.id] ?? 0) * 1.5;
		const scoreB = (likeCounts[b.id] ?? 0) + (commentCounts[b.id] ?? 0) * 1.5;
		return scoreB - scoreA;
	});

	return {
		discoverPosts: postsData,
		discoverNextCursor: nextCursor,
		likeCounts,
		isSignedIn: !!user,
		userHasLocation
	};
};
