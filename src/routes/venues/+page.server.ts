import type { PageServerLoad } from './$types';
import { PRIVATE_ADMIN_EMAIL } from '$env/static/private';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const [registeredResult, seededResult] = await Promise.all([
		supabase
			.from('profiles')
			.select('id, full_name, avatar_url, location, location_lat, location_lng, bio, tags')
			.eq('discoverable', true)
			.eq('profile_type', 'venue')
			.not('location_lat', 'is', null)
			.not('location_lng', 'is', null),
		supabase.from('venues').select('*')
	]);

	return {
		registeredVenues: registeredResult.data ?? [],
		seededVenues: seededResult.data ?? [],
		isAdmin: user?.email === PRIVATE_ADMIN_EMAIL,
		userId: user?.id ?? null
	};
};
