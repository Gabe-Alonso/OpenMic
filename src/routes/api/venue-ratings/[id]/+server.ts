import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { error } = await supabase.from('venue_ratings').delete().eq('id', params.id).eq('reviewer_id', user.id);

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ ok: true });
};
