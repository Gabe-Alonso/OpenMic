import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { boundingBoxForRadius, applyBoundingBox, withinRadius } from '$lib/server/geo';

// Caps how many points a single viewport/radius fetch can return. At this
// app's current scale (~1,500 artists) this only matters when zoomed out to
// roughly a continent or further — the same "zoom in to see more" tradeoff
// real map products make, in exchange for never shipping the whole table.
const RESULT_CAP = 500;

const BASE_COLUMNS =
	'id, full_name, avatar_url, location, location_lat, location_lng, bio, tags, profile_type, artist_roles';

async function followerCountsFor(supabase: any, ids: string[]): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	if (ids.length === 0) return counts;
	const { data: follows } = await supabase.from('follows').select('following_id').in('following_id', ids);
	for (const f of follows ?? []) counts[f.following_id] = (counts[f.following_id] ?? 0) + 1;
	return counts;
}

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const baseFilters = (q: any) =>
		q.eq('discoverable', true).eq('profile_type', 'artist').not('location_lat', 'is', null).not('location_lng', 'is', null);

	// Lightweight mode: only lat/lng for every matching row, used once on page
	// load to fit the map to the data without pulling full profile rows for
	// artists that may be nowhere near the viewport.
	if (url.searchParams.get('extent') === 'true') {
		const { data } = await baseFilters(supabase.from('profiles').select('location_lat, location_lng'));
		return json({ points: data ?? [] });
	}

	const lat = url.searchParams.get('lat');
	const lng = url.searchParams.get('lng');
	const radius = url.searchParams.get('radius');

	let query = baseFilters(supabase.from('profiles').select(BASE_COLUMNS)).limit(RESULT_CAP);
	let radiusFilter: { lat: number; lng: number; radius: number } | null = null;

	if (lat && lng && radius) {
		const latN = parseFloat(lat);
		const lngN = parseFloat(lng);
		const radiusN = parseFloat(radius);
		query = applyBoundingBox(query, boundingBoxForRadius(latN, lngN, radiusN));
		radiusFilter = { lat: latN, lng: lngN, radius: radiusN };
	} else {
		const minLat = parseFloat(url.searchParams.get('minLat') ?? '');
		const maxLat = parseFloat(url.searchParams.get('maxLat') ?? '');
		const minLng = parseFloat(url.searchParams.get('minLng') ?? '');
		const maxLng = parseFloat(url.searchParams.get('maxLng') ?? '');
		if ([minLat, maxLat, minLng, maxLng].some(Number.isNaN)) {
			return json({ error: 'minLat/maxLat/minLng/maxLng or lat/lng/radius required' }, { status: 400 });
		}
		query = query.gte('location_lat', minLat).lte('location_lat', maxLat);
		// Longitude can wrap past +/-180 when the viewport crosses the antimeridian.
		query =
			minLng > maxLng
				? query.or(`location_lng.gte.${minLng},location_lng.lte.${maxLng}`)
				: query.gte('location_lng', minLng).lte('location_lng', maxLng);
	}

	const { data: artists } = await query;
	let artistsData = artists ?? [];
	if (radiusFilter) {
		artistsData = withinRadius(artistsData, radiusFilter.lat, radiusFilter.lng, radiusFilter.radius);
	}

	const followerCounts = await followerCountsFor(supabase, artistsData.map((a: any) => a.id));
	return json({ artists: artistsData, followerCounts });
};
