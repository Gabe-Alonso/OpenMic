import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw redirect(302, '/signin');

	const { data: conversations } = await supabase.rpc('get_my_conversations', {
		p_user_id: user.id
	});

	const { data: following } = await supabase
		.from('follows')
		.select('profiles!follows_following_id_fkey(id, full_name, avatar_url)')
		.eq('follower_id', user.id);

	return {
		conversations: conversations ?? [],
		userId: user.id,
		following: (following ?? []).map((f: any) => f.profiles).filter(Boolean)
	};
};
