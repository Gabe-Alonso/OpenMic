import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');

	const { data: convo } = await supabase
		.from('conversations')
		.select('participant_1, participant_2, is_group')
		.eq('id', params.id)
		.single();

	if (!convo) throw error(404, 'Not found');

	if (convo.is_group) {
		const { data: member } = await supabase
			.from('conversation_participants')
			.select('user_id')
			.eq('conversation_id', params.id)
			.eq('user_id', user.id)
			.maybeSingle();
		if (!member) throw error(403, 'Forbidden');
		await supabase
			.from('conversation_participants')
			.update({ last_read_at: new Date().toISOString() })
			.eq('conversation_id', params.id)
			.eq('user_id', user.id);
	} else {
		if (convo.participant_1 !== user.id && convo.participant_2 !== user.id) throw error(403, 'Forbidden');
		await supabase
			.from('messages')
			.update({ read_at: new Date().toISOString() })
			.eq('conversation_id', params.id)
			.neq('sender_id', user.id)
			.is('read_at', null);
	}

	return json({ ok: true });
};
