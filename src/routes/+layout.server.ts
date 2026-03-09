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
		const { data: convos } = await supabase
			.from('conversations')
			.select('id')
			.or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
			.is('request_status', null);
		const ids = (convos ?? []).map((c: any) => c.id);
		if (ids.length > 0) {
			const { count } = await supabase
				.from('messages')
				.select('id', { count: 'exact', head: true })
				.in('conversation_id', ids)
				.is('read_at', null)
				.neq('sender_id', user.id);
			unreadCount = count ?? 0;
		}
	}

	return { session, user, avatarUrl, unreadCount };
};
