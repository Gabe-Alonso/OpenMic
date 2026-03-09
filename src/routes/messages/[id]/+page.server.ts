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
	if (convo.participant_1 !== user.id && convo.participant_2 !== user.id) {
		throw error(403, 'Forbidden');
	}

	const otherId = convo.participant_1 === user.id ? convo.participant_2 : convo.participant_1;

	const [{ data: otherProfile }, { data: messages }] = await Promise.all([
		supabase.from('profiles').select('id, full_name, avatar_url').eq('id', otherId).single(),
		supabase
			.from('messages')
			.select('*')
			.eq('conversation_id', params.id)
			.order('created_at', { ascending: true })
			.limit(100)
	]);

	return {
		conversation: convo,
		otherProfile: otherProfile ?? { id: otherId, full_name: null, avatar_url: null },
		messages: messages ?? [],
		userId: user.id
	};
};
