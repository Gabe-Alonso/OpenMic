import { distanceMiles } from '$lib/geo';

// A plain two-column B-tree index on (location_lat, location_lng) can't do a
// true 2D lookup the way a PostGIS GiST index over a geography column can —
// Postgres uses the index to narrow down one of the two range conditions and
// re-checks the other with a filter. It's still a large win over a full scan
// (see the before/after query plans), and avoids adding a geography column
// and its own migration for what is, at this app's scale, a solved problem.
// If the table ever grows enough for that filter re-check to matter, a GiST
// index over a geography column is the natural next step.

export type BoundingBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

const MILES_PER_DEGREE_LAT = 69.0;

// A conservative (slightly oversized) rectangle around a point, sized in
// degrees for a given radius in miles. Oversized on purpose: it's a cheap
// prefilter meant to shrink an unindexed full-table scan down to a small
// candidate set, not the final answer — call `withinRadius` afterwards for
// the precise circular distance check.
export function boundingBoxForRadius(lat: number, lng: number, radiusMiles: number): BoundingBox {
	const latDelta = radiusMiles / MILES_PER_DEGREE_LAT;
	const milesPerDegreeLng = MILES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
	// Near the poles this would blow up; nobody's booking a gig there.
	const lngDelta = radiusMiles / Math.max(milesPerDegreeLng, 1);
	return {
		minLat: lat - latDelta,
		maxLat: lat + latDelta,
		minLng: lng - lngDelta,
		maxLng: lng + lngDelta
	};
}

export function applyBoundingBox<T>(query: T, box: BoundingBox): T {
	return (query as any)
		.gte('location_lat', box.minLat)
		.lte('location_lat', box.maxLat)
		.gte('location_lng', box.minLng)
		.lte('location_lng', box.maxLng);
}

// The bounding box over-includes the corners of its rectangle; this trims
// the candidate set down to the actual circle.
export function withinRadius<T extends { location_lat: number | null; location_lng: number | null }>(
	rows: T[],
	lat: number,
	lng: number,
	radiusMiles: number
): T[] {
	return rows.filter(
		(r) => r.location_lat != null && r.location_lng != null && distanceMiles(lat, lng, r.location_lat, r.location_lng) <= radiusMiles
	);
}
