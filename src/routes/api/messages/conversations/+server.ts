import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { other_user_id, participant_ids, group_name } = body;

	// Group chat creation
	if (participant_ids?.length > 0) {
		if (participant_ids.includes(user.id)) throw error(400, 'Cannot include yourself');
		if (participant_ids.length >= 10) throw error(400, 'Max 9 other participants');
		const { data: convoId, error: rpcErr } = await supabase.rpc('create_group_conversation', {
			p_creator_id: user.id,
			p_participant_ids: participant_ids,
			p_group_name: group_name ?? null
		});
		if (rpcErr) throw error(500, rpcErr.message);
		return json({ conversationId: convoId });
	}

	if (!other_user_id || other_user_id === user.id) throw error(400, 'Invalid user');

	const p1 = user.id < other_user_id ? user.id : other_user_id;
	const p2 = user.id < other_user_id ? other_user_id : user.id;

	// Check for existing conversation
	const { data: existing } = await supabase
		.from('conversations')
		.select('id, request_status')
		.eq('participant_1', p1)
		.eq('participant_2', p2)
		.maybeSingle();

	if (existing) {
		return json({ conversationId: existing.id, requestStatus: existing.request_status });
	}

	// Determine if recipient follows sender
	const { data: followRow } = await supabase
		.from('follows')
		.select('id')
		.eq('follower_id', other_user_id)
		.eq('following_id', user.id)
		.maybeSingle();

	const requestStatus = followRow ? null : 'pending';

	const { data: convo, error: insertErr } = await supabase
		.from('conversations')
		.insert({
			participant_1: p1,
			participant_2: p2,
			request_status: requestStatus,
			request_from: requestStatus === 'pending' ? user.id : null
		})
		.select('id, request_status')
		.single();

	if (insertErr) throw error(500, insertErr.message);

	return json({ conversationId: convo.id, requestStatus: convo.request_status });
};
