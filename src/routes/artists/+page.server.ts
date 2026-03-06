import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: artists } = await supabase
		.from('profiles')
		.select('id, full_name, avatar_url, location, location_lat, location_lng, bio')
		.eq('discoverable', true)
		.not('location_lat', 'is', null)
		.not('location_lng', 'is', null);

	return { artists: artists ?? [] };
};
