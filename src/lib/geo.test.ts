import { describe, it, expect } from 'vitest';
import { distanceMiles, radiusToZoom } from './geo';

describe('distanceMiles', () => {
	it('is zero for the same point', () => {
		expect(distanceMiles(30.27, -97.74, 30.27, -97.74)).toBe(0);
	});

	it('is roughly 2,445 miles from New York to Los Angeles', () => {
		const miles = distanceMiles(40.7128, -74.006, 34.0522, -118.2437);
		expect(miles).toBeGreaterThan(2400);
		expect(miles).toBeLessThan(2480);
	});

	it('is the same in both directions', () => {
		const ab = distanceMiles(51.5, -0.12, 48.85, 2.35);
		const ba = distanceMiles(48.85, 2.35, 51.5, -0.12);
		expect(ab).toBeCloseTo(ba, 6);
	});
});

describe('radiusToZoom', () => {
	it.each([
		[1, 11],
		[10, 11],
		[11, 10],
		[25, 10],
		[26, 9],
		[50, 9],
		[51, 8],
		[100, 8],
		[101, 7],
		[250, 7]
	])('maps %i miles to zoom %i', (miles, zoom) => {
		expect(radiusToZoom(miles)).toBe(zoom);
	});
});
