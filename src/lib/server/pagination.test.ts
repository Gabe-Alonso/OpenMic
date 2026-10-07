import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, paginateRows } from './pagination';

describe('encodeCursor / decodeCursor', () => {
	it('round-trips a cursor', () => {
		const cursor = { createdAt: '2026-01-05T12:00:00.000Z', id: 'abc-123' };
		expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
	});

	it('returns null for a missing cursor', () => {
		expect(decodeCursor(null)).toBeNull();
		expect(decodeCursor(undefined)).toBeNull();
		expect(decodeCursor('')).toBeNull();
	});

	it('returns null instead of throwing for a tampered or malformed cursor', () => {
		expect(decodeCursor('not-base64url-json')).toBeNull();
		expect(decodeCursor(Buffer.from('{"createdAt":123}').toString('base64url'))).toBeNull();
	});
});

describe('paginateRows', () => {
	function row(id: string, createdAt: string) {
		return { id, created_at: createdAt, value: id };
	}

	it('returns everything with no next cursor when there is no extra row', () => {
		const rows = [row('a', '2026-01-03T00:00:00Z'), row('b', '2026-01-02T00:00:00Z')];
		const { page, nextCursor } = paginateRows(rows, 2);
		expect(page).toHaveLength(2);
		expect(nextCursor).toBeNull();
	});

	it('trims the over-fetched row and derives a cursor from the last visible row', () => {
		const rows = [
			row('a', '2026-01-03T00:00:00Z'),
			row('b', '2026-01-02T00:00:00Z'),
			row('c', '2026-01-01T00:00:00Z') // the "limit + 1"th row, proof a next page exists
		];
		const { page, nextCursor } = paginateRows(rows, 2);
		expect(page.map((r) => r.id)).toEqual(['a', 'b']);
		expect(decodeCursor(nextCursor)).toEqual({ createdAt: '2026-01-02T00:00:00Z', id: 'b' });
	});
});
