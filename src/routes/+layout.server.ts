import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session, user } = await safeGetSession();

	let avatarUrl: string | null = null;
	if (user) {
		const { data } = await supabase
			.from('profiles')
			.select('avatar_url')
			.eq('id', user.id)
			.single();
		avatarUrl = data?.avatar_url ?? null;
	}

	let unreadCount = 0;
	if (user) {
		// DM unread: messages with read_at=null from other person in accepted DMs
		const { data: dmConvos } = await supabase
			.from('conversations')
			.select('id')
			.or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
			.eq('is_group', false)
			.is('request_status', null);
		const dmIds = (dmConvos ?? []).map((c: any) => c.id);
		if (dmIds.length > 0) {
			const { count } = await supabase
				.from('messages')
				.select('id', { count: 'exact', head: true })
				.in('conversation_id', dmIds)
				.is('read_at', null)
				.neq('sender_id', user.id);
			unreadCount += count ?? 0;
		}

		// Group unread: messages after user's last_read_at
		const { data: groupMemberships } = await supabase
			.from('conversation_participants')
			.select('conversation_id, last_read_at')
			.eq('user_id', user.id);
		for (const m of groupMemberships ?? []) {
			const q = supabase
				.from('messages')
				.select('id', { count: 'exact', head: true })
				.eq('conversation_id', m.conversation_id)
				.neq('sender_id', user.id);
			if (m.last_read_at) q.gt('created_at', m.last_read_at);
			const { count } = await q;
			unreadCount += count ?? 0;
		}
	}

	return { session, user, avatarUrl, unreadCount };
};
