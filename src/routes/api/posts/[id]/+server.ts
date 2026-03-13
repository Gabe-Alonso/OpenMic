import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { error } = await supabase
		.from('posts')
		.delete()
		.eq('id', params.id)
		.eq('author_id', user.id);

	if (error) return json({ error: error.message }, { status: 500 });

	return json({ ok: true });
};

export const PATCH: RequestHandler = async ({ params, request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { body, tags } = await request.json();

	if (body && body.length > 5000) return json({ error: 'Post must be 5000 characters or fewer' }, { status: 400 });

	const validatedTags = Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string' && t.length <= 50).slice(0, 20) : [];

	const { error } = await supabase
		.from('posts')
		.update({
			body: body ?? null,
			tags: validatedTags,
			edited_at: new Date().toISOString()
		})
		.eq('id', params.id)
		.eq('author_id', user.id);

	if (error) return json({ error: error.message }, { status: 500 });

	return json({ ok: true });
};
