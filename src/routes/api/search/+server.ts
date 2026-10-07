import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 2) return json({ profiles: [], posts: [], venues: [] });

	const [profilesRes, postsRes, venuesRes] = await Promise.all([
		supabase.rpc('search_profiles', { search_query: q, result_limit: 5 }),
		supabase.rpc('search_posts', { search_query: q, result_limit: 5 }),
		supabase.rpc('search_venues', { search_query: q, result_limit: 5 })
	]);

	const posts = postsRes.data ?? [];
	let postsWithAuthor: any[] = posts;

	if (posts.length > 0) {
		const authorIds = [...new Set(posts.map((p: any) => p.author_id))];
		const { data: authors } = await supabase
			.from('profiles')
			.select('id, full_name, avatar_url')
			.in('id', authorIds);
		const authorMap = new Map((authors ?? []).map((a: any) => [a.id, a]));
		postsWithAuthor = posts.map((p: any) => ({ ...p, author: authorMap.get(p.author_id) ?? null }));
	}

	return json({
		profiles: profilesRes.data ?? [],
		posts: postsWithAuthor,
		venues: venuesRes.data ?? []
	});
};
