import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: artists } = await supabase
		.from('profiles')
		.select('id, full_name, avatar_url, location, location_lat, location_lng, bio, tags, profile_type, artist_roles')
		.eq('discoverable', true)
		.eq('profile_type', 'artist')
		.not('location_lat', 'is', null)
		.not('location_lng', 'is', null);

	const artistsData = artists ?? [];

	const followerCounts: Record<string, number> = {};
	if (artistsData.length > 0) {
		const { data: follows } = await supabase
			.from('follows')
			.select('following_id')
			.in('following_id', artistsData.map((a) => a.id));
		for (const f of follows ?? []) {
			followerCounts[f.following_id] = (followerCounts[f.following_id] ?? 0) + 1;
		}
	}

	return { artists: artistsData, followerCounts };
};
