import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_ADMIN_EMAIL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');
	if (user.email !== PRIVATE_ADMIN_EMAIL) throw error(403, 'Forbidden');

	// Use service role client to bypass RLS for admin writes
	const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const body = await request.json();
	const { lat, lng, radius_km = 50 } = body;
	if (!lat || !lng) throw error(400, 'lat and lng required');

	const radiusM = Math.min(radius_km * 1000, 400000); // cap at 400 km (~250 mi)

	const query = `
[out:json][timeout:30];
(
  node["amenity"~"^(music_venue|nightclub|bar|theatre|concert_hall)$"]["name"](around:${radiusM},${lat},${lng});
  way["amenity"~"^(music_venue|nightclub|bar|theatre|concert_hall)$"]["name"](around:${radiusM},${lat},${lng});
  node["leisure"="arts_centre"]["name"](around:${radiusM},${lat},${lng});
  way["leisure"="arts_centre"]["name"](around:${radiusM},${lat},${lng});
);
out center body;
`;

	const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `data=${encodeURIComponent(query)}`
	});

	if (!overpassRes.ok) throw error(502, 'Overpass API error');

	const overpassData = await overpassRes.json();
	const elements: any[] = overpassData.elements ?? [];

	let inserted = 0;
	for (const el of elements) {
		const elLat = el.lat ?? el.center?.lat;
		const elLng = el.lon ?? el.center?.lon;
		if (!elLat || !elLng || !el.tags?.name) continue;

		const { error: upsertErr } = await adminSupabase.from('venues').upsert(
			{
				osm_id: `${el.type}/${el.id}`,
				name: el.tags.name,
				address:
					[el.tags['addr:housenumber'], el.tags['addr:street']].filter(Boolean).join(' ') || null,
				city: el.tags['addr:city'] ?? null,
				lat: elLat,
				lng: elLng,
				phone: el.tags.phone ?? el.tags['contact:phone'] ?? null,
				website: el.tags.website ?? el.tags['contact:website'] ?? null,
				venue_types: [el.tags.amenity ?? el.tags.leisure].filter(Boolean)
			},
			{ onConflict: 'osm_id' }
		);

		if (!upsertErr) inserted++;
	}

	return json({ inserted, total: elements.length });
};
