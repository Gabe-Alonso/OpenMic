import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { body, youtube_url, media, tags } = await request.json();

	if (body && body.length > 5000) return json({ error: 'Post must be 5000 characters or fewer' }, { status: 400 });

	if (youtube_url) {
		try {
			const u = new URL(youtube_url);
			if (!['https:'].includes(u.protocol) || !['www.youtube.com', 'youtube.com', 'youtu.be'].includes(u.hostname)) {
				return json({ error: 'Invalid YouTube URL' }, { status: 400 });
			}
		} catch {
			return json({ error: 'Invalid YouTube URL' }, { status: 400 });
		}
	}

	const validatedTags = Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string' && t.length <= 50).slice(0, 20) : [];

	const { data: post, error } = await supabase
		.from('posts')
		.insert({
			author_id: user.id,
			body: body || null,
			youtube_url: youtube_url || null,
			tags: validatedTags
		})
		.select('id')
		.single();

	if (error) return json({ error: error.message }, { status: 500 });

	if (media && media.length > 0) {
		const { error: mediaError } = await supabase.from('post_media').insert(
			media.map((m: { url: string; media_type: string }, i: number) => ({
				post_id: post.id,
				url: m.url,
				media_type: m.media_type,
				order_index: i
			}))
		);
		if (mediaError) return json({ error: mediaError.message }, { status: 500 });
	}

	return json({ id: post.id });
};
