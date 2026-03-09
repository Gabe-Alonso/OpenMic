import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');

	const { action } = await request.json();
	if (action !== 'accept') throw error(400, 'Invalid action');

	const { data: convo } = await supabase
		.from('conversations')
		.select('request_status, request_from, participant_1, participant_2')
		.eq('id', params.id)
		.single();

	if (!convo) throw error(404, 'Not found');
	if (convo.participant_1 !== user.id && convo.participant_2 !== user.id) throw error(403, 'Forbidden');
	if (convo.request_status !== 'pending') throw error(400, 'Not a pending request');
	if (convo.request_from === user.id) throw error(403, 'Cannot accept your own request');

	await supabase
		.from('conversations')
		.update({ request_status: null, request_from: null })
		.eq('id', params.id);

	return json({ ok: true });
};
