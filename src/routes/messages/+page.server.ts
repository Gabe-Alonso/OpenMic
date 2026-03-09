import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw redirect(302, '/signin');

	const { data: conversations } = await supabase.rpc('get_my_conversations', {
		p_user_id: user.id
	});

	return { conversations: conversations ?? [], userId: user.id };
};
