import { describe, it, expect, vi, afterEach } from 'vitest';
import { stripHtml, timeAgo, parseYoutubeId } from './format';

describe('stripHtml', () => {
	it('removes tags and collapses whitespace', () => {
		expect(stripHtml('<p>Hello   <strong>world</strong></p>\n<p>again</p>')).toBe('Hello world again');
	});

	it('returns an empty string for null', () => {
		expect(stripHtml(null)).toBe('');
	});
});

describe('timeAgo', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	function at(now: string) {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(now));
	}

	it('reports minutes under an hour', () => {
		at('2026-01-01T12:30:00Z');
		expect(timeAgo('2026-01-01T12:00:00Z')).toBe('30m ago');
	});

	it('reports hours under a day', () => {
		at('2026-01-02T11:00:00Z');
		expect(timeAgo('2026-01-01T12:00:00Z')).toBe('23h ago');
	});

	it('switches to days at exactly 24 hours', () => {
		at('2026-01-02T12:00:00Z');
		expect(timeAgo('2026-01-01T12:00:00Z')).toBe('1d ago');
	});

	it('reports days under thirty', () => {
		at('2026-01-11T12:00:00Z');
		expect(timeAgo('2026-01-01T12:00:00Z')).toBe('10d ago');
	});
});

describe('parseYoutubeId', () => {
	it('reads the id from a watch URL', () => {
		expect(parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('reads the id from a short youtu.be URL', () => {
		expect(parseYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('returns null for anything that is not a YouTube video URL', () => {
		expect(parseYoutubeId('https://example.com/video')).toBeNull();
		expect(parseYoutubeId('https://www.youtube.com/watch?v=short')).toBeNull();
	});
});
