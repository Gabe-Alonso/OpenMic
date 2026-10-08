import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkRateLimit, rateLimitResponse } from '$lib/server/rateLimit';
import { newCommentEmail } from '$lib/server/email';
import { notify } from '$lib/server/notify';

export const GET: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const [{ data: post }, { data: comments }] = await Promise.all([
		supabase.from('posts').select('author_id').eq('id', params.id).single(),
		supabase
			.from('post_comments')
			.select('id, content, created_at, parent_id, author_id, profiles(id, full_name, avatar_url)')
			.eq('post_id', params.id)
			.order('created_at', { ascending: true })
	]);

	if (!comments?.length) return json([]);

	const creatorId = post?.author_id as string | undefined;

	const { data: likes } = await supabase
		.from('comment_likes')
		.select('comment_id, user_id')
		.in('comment_id', comments.map((c) => c.id));

	const likesMap: Record<string, string[]> = {};
	for (const like of likes ?? []) {
		if (!likesMap[like.comment_id]) likesMap[like.comment_id] = [];
		likesMap[like.comment_id].push(like.user_id);
	}

	const flat: any[] = comments.map((c) => ({
		id: c.id,
		content: c.content,
		created_at: c.created_at,
		parent_id: c.parent_id,
		author: c.profiles,
		likeCount: likesMap[c.id]?.length ?? 0,
		userLiked: user ? (likesMap[c.id]?.includes(user.id) ?? false) : false,
		creatorLiked: creatorId ? (likesMap[c.id]?.includes(creatorId) ?? false) : false,
		replies: [] as any[]
	}));

	const byId: Record<string, any> = Object.fromEntries(flat.map((c) => [c.id, c]));
	const roots: any[] = [];
	for (const c of flat) {
		if (c.parent_id && byId[c.parent_id]) {
			byId[c.parent_id].replies.push(c);
		} else {
			roots.push(c);
		}
	}

	roots.sort((a, b) => b.likeCount - a.likeCount);

	return json(roots);
};

export const POST: RequestHandler = async ({ params, request, url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	if (!(await checkRateLimit(supabase, `comment:create:${user.id}`, { windowSeconds: 300, max: 20 }))) {
		return rateLimitResponse();
	}

	const { content, parent_id } = await request.json();
	if (!content?.trim()) return json({ error: 'Content required' }, { status: 400 });
	if (content.length > 2000) return json({ error: 'Comment must be 2000 characters or fewer' }, { status: 400 });

	const { data, error } = await supabase
		.from('post_comments')
		.insert({
			post_id: params.id,
			author_id: user.id,
			content: content.trim(),
			parent_id: parent_id ?? null
		})
		.select('id, content, created_at, parent_id, author_id, profiles(id, full_name, avatar_url)')
		.single();

	if (error) return json({ error: error.message }, { status: 500 });

	const { data: post } = await supabase.from('posts').select('author_id').eq('id', params.id).maybeSingle();
	if (post && post.author_id !== user.id) {
		const commenterName = (data.profiles as any)?.full_name ?? 'Someone';
		const { subject, html } = newCommentEmail(commenterName, data.content, `${url.origin}/post/${params.id}`);
		await notify(post.author_id, 'new_comment', {
			inApp: { title: `${commenterName} commented on your post`, body: data.content.slice(0, 200), link: `/post/${params.id}` },
			email: { subject, html }
		});
	}

	return json({
		id: data.id,
		content: data.content,
		created_at: data.created_at,
		parent_id: data.parent_id,
		author: data.profiles,
		likeCount: 0,
		userLiked: false,
		creatorLiked: false,
		replies: []
	});
};
