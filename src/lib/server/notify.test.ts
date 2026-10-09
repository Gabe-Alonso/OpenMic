import { describe, it, expect } from 'vitest';
import { passesNearbyEventFilters, type NearbyEventFilters } from './notify';

describe('passesNearbyEventFilters', () => {
	it('passes everything when no filters are set (the default for every recipient)', () => {
		expect(passesNearbyEventFilters(undefined, 49, null, null, [])).toBe(true);
	});

	describe('distance', () => {
		it('falls back to the 50mi default when the filter is off, even with a max_miles value stored', () => {
			const filters: NearbyEventFilters = { distance: { enabled: false, max_miles: 10 } };
			expect(passesNearbyEventFilters(filters, 49, null, null, [])).toBe(true);
			expect(passesNearbyEventFilters(filters, 51, null, null, [])).toBe(false);
		});

		it('uses the custom radius once enabled', () => {
			const filters: NearbyEventFilters = { distance: { enabled: true, max_miles: 100 } };
			expect(passesNearbyEventFilters(filters, 99, null, null, [])).toBe(true);
			expect(passesNearbyEventFilters(filters, 101, null, null, [])).toBe(false);
		});
	});

	describe('pay', () => {
		it('fails closed when enabled but the event lists no pay at all', () => {
			const filters: NearbyEventFilters = { pay: { enabled: true, min_pay: 50 } };
			expect(passesNearbyEventFilters(filters, 1, null, null, [])).toBe(false);
		});

		it('matches against the event\'s max when both min and max are given', () => {
			const filters: NearbyEventFilters = { pay: { enabled: true, min_pay: 100 } };
			expect(passesNearbyEventFilters(filters, 1, 50, 150, [])).toBe(true);
			expect(passesNearbyEventFilters(filters, 1, 50, 80, [])).toBe(false);
		});

		it('is ignored entirely when disabled, regardless of the event\'s pay', () => {
			const filters: NearbyEventFilters = { pay: { enabled: false, min_pay: 1000 } };
			expect(passesNearbyEventFilters(filters, 1, null, null, [])).toBe(true);
		});
	});

	describe('genres', () => {
		it('fails closed when enabled but nothing is selected', () => {
			const filters: NearbyEventFilters = { genres: { enabled: true, values: [] } };
			expect(passesNearbyEventFilters(filters, 1, null, null, ['rock'])).toBe(false);
		});

		it('requires at least one overlapping genre', () => {
			const filters: NearbyEventFilters = { genres: { enabled: true, values: ['jazz', 'blues'] } };
			expect(passesNearbyEventFilters(filters, 1, null, null, ['rock', 'jazz'])).toBe(true);
			expect(passesNearbyEventFilters(filters, 1, null, null, ['rock', 'metal'])).toBe(false);
		});

		it('fails closed when enabled but the event has no genres listed', () => {
			const filters: NearbyEventFilters = { genres: { enabled: true, values: ['jazz'] } };
			expect(passesNearbyEventFilters(filters, 1, null, null, [])).toBe(false);
		});
	});

	it('requires every enabled filter to pass (AND, not OR)', () => {
		const filters: NearbyEventFilters = {
			distance: { enabled: true, max_miles: 50 },
			pay: { enabled: true, min_pay: 100 },
			genres: { enabled: true, values: ['jazz'] }
		};
		// Distance ok, pay ok, genre fails -> overall fails.
		expect(passesNearbyEventFilters(filters, 10, 150, 150, ['rock'])).toBe(false);
		// All three pass.
		expect(passesNearbyEventFilters(filters, 10, 150, 150, ['jazz'])).toBe(true);
	});
});
