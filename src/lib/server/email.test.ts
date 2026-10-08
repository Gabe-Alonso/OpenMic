import { describe, it, expect } from 'vitest';
import {
	escapeHtml,
	newFollowerEmail,
	newCommentEmail,
	bandJoinRequestEmail,
	bandJoinAcceptedEmail,
	nearbyEventEmail,
	sendEmail
} from './email';

describe('escapeHtml', () => {
	it('escapes HTML special characters', () => {
		expect(escapeHtml('<script>alert("hi")</script>')).toBe('&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;');
	});
});

describe('email templates', () => {
	it('newFollowerEmail escapes the follower name in the body and links to their profile', () => {
		const { html } = newFollowerEmail('<b>Evil</b>', 'https://example.com/profile/1');
		expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
		expect(html).not.toContain('<b>Evil</b>');
		expect(html).toContain('https://example.com/profile/1');
	});

	it('newCommentEmail truncates the preview to 200 characters and escapes it', () => {
		const longText = 'a'.repeat(300);
		const { html } = newCommentEmail('Jane', longText, 'https://example.com/post/1');
		expect(html).toContain('a'.repeat(200));
		expect(html).not.toContain('a'.repeat(201));
		expect(html).toContain('https://example.com/post/1');
	});

	it('bandJoinRequestEmail and bandJoinAcceptedEmail link to the band profile', () => {
		expect(bandJoinRequestEmail('Jane', 'https://x.test/profile/1').html).toContain('https://x.test/profile/1');
		expect(bandJoinAcceptedEmail('The Band', 'https://x.test/profile/1').html).toContain('https://x.test/profile/1');
	});

	it('nearbyEventEmail includes the host, title, date, and link', () => {
		const { subject, html } = nearbyEventEmail('The Venue', 'Open Mic Night', '2026-05-01', 'https://x.test/profile/1');
		expect(subject).toContain('Open Mic Night');
		expect(html).toContain('The Venue');
		expect(html).toContain('Open Mic Night');
		expect(html).toContain('2026-05-01');
		expect(html).toContain('https://x.test/profile/1');
	});
});

describe('sendEmail', () => {
	it('no-ops without throwing when RESEND_API_KEY is not configured (true for this test run)', async () => {
		await expect(sendEmail('someone@example.com', 'subject', '<p>html</p>')).resolves.toBeUndefined();
	});
});
