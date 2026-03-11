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

	const { error } = await supabase
		.from('posts')
		.update({
			body: body ?? null,
			tags: tags ?? [],
			edited_at: new Date().toISOString()
		})
		.eq('id', params.id)
		.eq('author_id', user.id);

	if (error) return json({ error: error.message }, { status: 500 });

	return json({ ok: true });
};
