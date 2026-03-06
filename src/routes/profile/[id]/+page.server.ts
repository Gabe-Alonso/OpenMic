import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!profile) throw error(404, 'Profile not found');

	return { profile };
};
