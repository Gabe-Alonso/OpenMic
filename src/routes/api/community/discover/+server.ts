import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { decodeCursor, applyCursor, paginateRows } from '$lib/server/pagination';
import { embedEngagement } from '$lib/server/feed';

const PAGE_SIZE = 20;

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const cursor = decodeCursor(url.searchParams.get('cursor'));

	let query = supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url)')
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(PAGE_SIZE + 1);
	query = applyCursor(query, cursor);

	const { data: posts } = await query;
	const { page: postsData, nextCursor } = paginateRows(posts ?? [], PAGE_SIZE);
	const embedded = await embedEngagement(supabase, postsData, user?.id);

	embedded.sort((a, b) => {
		const scoreA = a.likeCount + a.commentCount * 1.5;
		const scoreB = b.likeCount + b.commentCount * 1.5;
		return scoreB - scoreA;
	});

	return json({ posts: embedded, nextCursor });
};
