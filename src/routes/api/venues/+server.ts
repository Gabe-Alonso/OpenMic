import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { boundingBoxForRadius, applyBoundingBox, withinRadius } from '$lib/server/geo';

// See src/routes/api/artists/+server.ts for the reasoning behind the cap and
// the bounding-box/radius split — same approach, applied to the two venue
// sources (registered profiles and the separately-seeded venues table).
const RESULT_CAP = 500;

function applyVenueBoundingBox(query: any, box: ReturnType<typeof boundingBoxForRadius>) {
	let q = query.gte('lat', box.minLat).lte('lat', box.maxLat);
	q = box.minLng > box.maxLng ? q.or(`lng.gte.${box.minLng},lng.lte.${box.maxLng}`) : q.gte('lng', box.minLng).lte('lng', box.maxLng);
	return q;
}

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	if (url.searchParams.get('extent') === 'true') {
		const [{ data: profilePoints }, { data: venuePoints }] = await Promise.all([
			supabase
				.from('profiles')
				.select('location_lat, location_lng')
				.eq('discoverable', true)
				.eq('profile_type', 'venue')
				.not('location_lat', 'is', null)
				.not('location_lng', 'is', null),
			supabase.from('venues').select('lat, lng')
		]);
		const points = [
			...(profilePoints ?? []),
			...(venuePoints ?? []).map((v: any) => ({ location_lat: v.lat, location_lng: v.lng }))
		];
		return json({ points });
	}

	const lat = url.searchParams.get('lat');
	const lng = url.searchParams.get('lng');
	const radius = url.searchParams.get('radius');
	const claimedOnly = url.searchParams.get('claimedOnly') === 'true';

	let radiusFilter: { lat: number; lng: number; radius: number } | null = null;
	let profileQuery = supabase
		.from('profiles')
		.select('id, full_name, avatar_url, location, location_lat, location_lng, bio, tags')
		.eq('discoverable', true)
		.eq('profile_type', 'venue')
		.not('location_lat', 'is', null)
		.not('location_lng', 'is', null)
		.limit(RESULT_CAP);
	let venueQuery = supabase.from('venues').select('*').limit(RESULT_CAP);
	if (claimedOnly) venueQuery = venueQuery.not('claimed_profile_id', 'is', null);

	if (lat && lng && radius) {
		const latN = parseFloat(lat);
		const lngN = parseFloat(lng);
		const radiusN = parseFloat(radius);
		const box = boundingBoxForRadius(latN, lngN, radiusN);
		profileQuery = applyBoundingBox(profileQuery, box);
		venueQuery = applyVenueBoundingBox(venueQuery, box);
		radiusFilter = { lat: latN, lng: lngN, radius: radiusN };
	} else {
		const minLat = parseFloat(url.searchParams.get('minLat') ?? '');
		const maxLat = parseFloat(url.searchParams.get('maxLat') ?? '');
		const minLng = parseFloat(url.searchParams.get('minLng') ?? '');
		const maxLng = parseFloat(url.searchParams.get('maxLng') ?? '');
		if ([minLat, maxLat, minLng, maxLng].some(Number.isNaN)) {
			return json({ error: 'minLat/maxLat/minLng/maxLng or lat/lng/radius required' }, { status: 400 });
		}
		const box = { minLat, maxLat, minLng, maxLng };
		profileQuery = applyBoundingBox(profileQuery, box);
		venueQuery = applyVenueBoundingBox(venueQuery, box);
	}

	const [{ data: registeredRaw }, { data: seededRaw }] = await Promise.all([profileQuery, venueQuery]);

	let registeredVenues = registeredRaw ?? [];
	let seededVenues = seededRaw ?? [];
	if (radiusFilter) {
		registeredVenues = withinRadius(registeredVenues, radiusFilter.lat, radiusFilter.lng, radiusFilter.radius);
		seededVenues = withinRadius(
			seededVenues.map((v: any) => ({ ...v, location_lat: v.lat, location_lng: v.lng })),
			radiusFilter.lat,
			radiusFilter.lng,
			radiusFilter.radius
		);
	}

	return json({ registeredVenues, seededVenues });
};
