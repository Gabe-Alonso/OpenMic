import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw redirect(302, '/signin');

	const { data: convo } = await supabase
		.from('conversations')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!convo) throw error(404, 'Conversation not found');

	if (convo.is_group) {
		const { data: member } = await supabase
			.from('conversation_participants')
			.select('user_id')
			.eq('conversation_id', params.id)
			.eq('user_id', user.id)
			.maybeSingle();
		if (!member) throw error(403, 'Forbidden');
	} else {
		if (convo.participant_1 !== user.id && convo.participant_2 !== user.id) {
			throw error(403, 'Forbidden');
		}
	}

	const { data: messages } = await supabase
		.from('messages')
		.select('*')
		.eq('conversation_id', params.id)
		.order('created_at', { ascending: true })
		.limit(100);

	if (convo.is_group) {
		const { data: participantRows } = await supabase
			.from('conversation_participants')
			.select('user_id, profiles(id, full_name, avatar_url)')
			.eq('conversation_id', params.id);

		return {
			conversation: convo,
			participants: (participantRows ?? []).map((r: any) => r.profiles).filter(Boolean),
			messages: messages ?? [],
			userId: user.id,
			otherProfile: null
		};
	}

	const otherId = convo.participant_1 === user.id ? convo.participant_2 : convo.participant_1;
	const { data: otherProfile } = await supabase
		.from('profiles')
		.select('id, full_name, avatar_url')
		.eq('id', otherId)
		.single();

	return {
		conversation: convo,
		participants: [],
		messages: messages ?? [],
		userId: user.id,
		otherProfile: otherProfile ?? { id: otherId, full_name: null, avatar_url: null }
	};
};
