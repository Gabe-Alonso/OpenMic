import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { body, youtube_url, media, tags } = await request.json();

	const { data: post, error } = await supabase
		.from('posts')
		.insert({
			author_id: user.id,
			body: body || null,
			youtube_url: youtube_url || null,
			tags: tags ?? []
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
