import { describe, it, expect } from 'vitest';
import { boundingBoxForRadius, withinRadius } from './geo';

describe('boundingBoxForRadius', () => {
	it('produces a box centered on the point', () => {
		const box = boundingBoxForRadius(30, -97, 50);
		expect(box.minLat).toBeLessThan(30);
		expect(box.maxLat).toBeGreaterThan(30);
		expect(box.minLng).toBeLessThan(-97);
		expect(box.maxLng).toBeGreaterThan(-97);
	});

	it('widens the longitude delta near the poles to keep the box honest', () => {
		// A degree of longitude covers less ground the further you are from
		// the equator, so the same radius needs a wider longitude span there.
		const nearEquator = boundingBoxForRadius(5, 0, 100);
		const nearPole = boundingBoxForRadius(80, 0, 100);
		const equatorLngSpan = nearEquator.maxLng - nearEquator.minLng;
		const poleLngSpan = nearPole.maxLng - nearPole.minLng;
		expect(poleLngSpan).toBeGreaterThan(equatorLngSpan);
	});
});

describe('withinRadius', () => {
	const austin = { location_lat: 30.27, location_lng: -97.74 };
	const dallas = { location_lat: 32.78, location_lng: -96.8 }; // ~182 miles from Austin
	const nullIsland = { location_lat: null, location_lng: null };

	it('keeps points inside the radius and drops points outside it', () => {
		const result = withinRadius([austin, dallas], austin.location_lat, austin.location_lng, 50);
		expect(result).toEqual([austin]);
	});

	it('includes a point exactly on the boundary within both radii', () => {
		const near = withinRadius([dallas], austin.location_lat, austin.location_lng, 200);
		expect(near).toEqual([dallas]);
	});

	it('drops rows with a missing lat/lng instead of throwing', () => {
		const result = withinRadius([austin, nullIsland as any], austin.location_lat, austin.location_lng, 50);
		expect(result).toEqual([austin]);
	});
});
