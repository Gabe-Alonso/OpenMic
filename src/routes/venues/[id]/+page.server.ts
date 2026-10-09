import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: venue } = await supabase
		.from('venues')
		.select('id, name, address, city, phone, website, venue_types, claimed_profile_id')
		.eq('id', params.id)
		.maybeSingle();

	if (!venue) throw error(404, 'Venue not found');

	// Once claimed, the registered profile is the canonical page — this one
	// only exists to give an unclaimed venue somewhere to be rated and
	// reviewed before anyone's claimed it.
	if (venue.claimed_profile_id) throw redirect(307, `/profile/${venue.claimed_profile_id}`);

	return { venue };
};
