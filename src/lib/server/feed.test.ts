import { describe, it, expect } from 'vitest';
import { mergeFeedStreams, type FeedCandidate } from './feed';

function item(sortAt: string, sortId: string, stream: 'a' | 'b'): FeedCandidate<{ label: string }> {
	return { label: `${stream}:${sortId}`, _sortAt: sortAt, _sortId: sortId, _stream: stream };
}

describe('mergeFeedStreams', () => {
	it('interleaves two streams by timestamp, newest first', () => {
		const a = [item('2024-01-05', 'a1', 'a'), item('2024-01-03', 'a2', 'a')];
		const b = [item('2024-01-04', 'b1', 'b'), item('2024-01-02', 'b2', 'b')];
		const { page } = mergeFeedStreams(a, b, 10, null, null);
		expect(page.map((p) => p.label)).toEqual(['a:a1', 'b:b1', 'a:a2', 'b:b2']);
	});

	it('reports no next page when both streams are exhausted by the fetch', () => {
		const a = [item('2024-01-05', 'a1', 'a')];
		const b = [item('2024-01-04', 'b1', 'b')];
		const { page, nextCursorA, nextCursorB } = mergeFeedStreams(a, b, 10, null, null);
		expect(page).toHaveLength(2);
		expect(nextCursorA).toBeNull();
		expect(nextCursorB).toBeNull();
	});

	it('advances each stream cursor to the last row of that stream actually emitted', () => {
		// pageSize 2, with stream A supplying rows 1 and 3 (by rank) and stream
		// B supplying row 2 — only the top 2 make the page: a1, b1. a2 is
		// fetched but not emitted, so A's cursor must stay at a1, not skip to a2.
		const a = [item('2024-01-05', 'a1', 'a'), item('2024-01-02', 'a2', 'a')];
		const b = [item('2024-01-04', 'b1', 'b')];
		const { page, nextCursorA, nextCursorB } = mergeFeedStreams(a, b, 2, null, null);
		expect(page.map((p) => p.label)).toEqual(['a:a1', 'b:b1']);
		expect(nextCursorA).toEqual({ createdAt: '2024-01-05', id: 'a1' });
		expect(nextCursorB).toEqual({ createdAt: '2024-01-04', id: 'b1' });
	});

	it('keeps a stream\'s previous cursor unchanged when it contributes nothing to this page', () => {
		// Stream B has nothing newer than the page cutoff this round; its
		// cursor must not move, so a later page can still pick up its rows
		// once they rank high enough.
		const a = [item('2024-01-05', 'a1', 'a'), item('2024-01-04', 'a2', 'a'), item('2024-01-03', 'a3', 'a')];
		const b: FeedCandidate<{ label: string }>[] = [];
		const previousCursorB = { createdAt: '2023-12-01', id: 'bOld' };
		const { page, nextCursorA, nextCursorB } = mergeFeedStreams(a, b, 2, null, previousCursorB);
		expect(page.map((p) => p.label)).toEqual(['a:a1', 'a:a2']);
		expect(nextCursorA).toEqual({ createdAt: '2024-01-04', id: 'a2' });
		expect(nextCursorB).toBe(previousCursorB);
	});

	it('breaks ties on sortId when sortAt is identical', () => {
		const a = [item('2024-01-05', 'bbb', 'a')];
		const b = [item('2024-01-05', 'aaa', 'b')];
		const { page } = mergeFeedStreams(a, b, 10, null, null);
		expect(page.map((p) => p.label)).toEqual(['a:bbb', 'b:aaa']);
	});
});
