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

	return { session, user, avatarUrl };
};
