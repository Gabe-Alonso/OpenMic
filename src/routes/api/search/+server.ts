import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 2) return json({ profiles: [], posts: [] });

	const tag = (q.startsWith('#') ? q.slice(1) : q).toLowerCase().replace(/[{}(),]/g, '').substring(0, 50);
	const nameQ = (q.startsWith('#') ? q.slice(1) : q).replace(/%/g, '\\%').replace(/_/g, '\\_').substring(0, 100);

	const [profilesRes, postsRes] = await Promise.all([
		supabase
			.from('profiles')
			.select('id, full_name, avatar_url, profile_type, location')
			.or(`full_name.ilike.%${nameQ}%,tags.cs.{${tag}}`)
			.eq('discoverable', true)
			.limit(5),
		supabase
			.from('posts')
			.select('id, content, tags, author_id, created_at')
			.contains('tags', [tag])
			.order('created_at', { ascending: false })
			.limit(5)
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
		posts: postsWithAuthor
	});
};
