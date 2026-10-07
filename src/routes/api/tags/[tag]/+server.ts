import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { decodeCursor, applyCursor, paginateRows } from '$lib/server/pagination';

const PAGE_SIZE = 20;

export const GET: RequestHandler = async ({ params, url, locals: { supabase } }) => {
	const tag = params.tag.toLowerCase();
	const cursor = decodeCursor(url.searchParams.get('cursor'));

	let query = supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url)')
		.contains('tags', [tag])
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(PAGE_SIZE + 1);
	query = applyCursor(query, cursor);

	const { data: posts } = await query;
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

	postsData.sort((a, b) => {
		const scoreA = (likeCounts[a.id] ?? 0) + (commentCounts[a.id] ?? 0) * 1.5;
		const scoreB = (likeCounts[b.id] ?? 0) + (commentCounts[b.id] ?? 0) * 1.5;
		return scoreB - scoreA;
	});

	return json({ posts: postsData, likeCounts, nextCursor });
};
