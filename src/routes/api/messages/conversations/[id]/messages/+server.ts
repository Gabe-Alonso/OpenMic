import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { message_type, content, image_url, youtube_url } = body;

	if (content && content.length > 2000) throw error(400, 'Message must be 2000 characters or fewer');

	const { data: convo } = await supabase
		.from('conversations')
		.select('request_status, request_from, participant_1, participant_2, is_group')
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
		if (!member) throw error(403, 'Not a member');
	} else {
		if (convo.participant_1 !== user.id && convo.participant_2 !== user.id) throw error(403, 'Forbidden');
		if (convo.request_status === 'pending' && convo.request_from !== user.id) {
			throw error(403, 'Accept the message request first');
		}
	}

	const { data: msg, error: insertErr } = await supabase
		.from('messages')
		.insert({
			conversation_id: params.id,
			sender_id: user.id,
			message_type: message_type ?? 'text',
			content: content ?? null,
			image_url: image_url ?? null,
			youtube_url: youtube_url ?? null
		})
		.select()
		.single();

	if (insertErr) throw error(500, insertErr.message);

	return json(msg);
};
