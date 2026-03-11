import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: venue } = await supabase
		.from('venues')
		.select('id, name, address, city, website, phone')
		.eq('id', params.id)
		.single();

	if (!venue) throw error(404, 'Venue not found');

	return { venue };
};
