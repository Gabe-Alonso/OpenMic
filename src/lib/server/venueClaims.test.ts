import { describe, it, expect } from 'vitest';
import { domainsMatch } from './venueClaims';

describe('domainsMatch', () => {
	it('matches a plain email domain against a plain website domain', () => {
		expect(domainsMatch('jane@thevenue.com', 'thevenue.com')).toBe(true);
	});

	it('ignores protocol and www on the website side', () => {
		expect(domainsMatch('jane@thevenue.com', 'https://www.thevenue.com/book-now')).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(domainsMatch('Jane@TheVenue.com', 'thevenue.COM')).toBe(true);
	});

	it('rejects a different domain', () => {
		expect(domainsMatch('jane@gmail.com', 'thevenue.com')).toBe(false);
	});

	it('rejects a subdomain mismatch (booking.thevenue.com vs thevenue.com)', () => {
		expect(domainsMatch('jane@thevenue.com', 'https://booking.thevenue.com')).toBe(false);
	});

	it('returns false when the venue has no website on file', () => {
		expect(domainsMatch('jane@thevenue.com', null)).toBe(false);
	});

	it('returns false for a malformed website value rather than throwing', () => {
		expect(domainsMatch('jane@thevenue.com', 'not a url at all???')).toBe(false);
	});
});
