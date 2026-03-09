import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const tag = params.tag.toLowerCase();

	const { data: posts } = await supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url)')
		.contains('tags', [tag])
		.order('created_at', { ascending: false })
		.limit(100);

	const postsData = posts ?? [];
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

	return { tag, posts: postsData, likeCounts };
};
