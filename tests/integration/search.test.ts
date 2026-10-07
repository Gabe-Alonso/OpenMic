// Integration tests: the full-text search route. Exercises the real
// search_posts/search_profiles/search_venues Postgres functions against the
// test project — no mocking the ranking/matching logic, since that's the
// whole point of the feature. See helpers.ts for why these run against a
// real test project, not mocks.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as searchRoute from '../../src/routes/api/search/+server';
import { configured, admin, makeUser, cleanupUser, buildEvent, callRoute } from './helpers';

function eventFor(q: string) {
	return buildEvent(null, {}, { method: 'GET', path: `/api/search?q=${encodeURIComponent(q)}` });
}

describe.skipIf(!configured)('search (integration)', () => {
	const token = `zzqsearch${Date.now()}`;
	let userId: string;
	let postId: string;
	let venueId: string;

	beforeAll(async () => {
		const u = await makeUser('search-author', false);
		userId = u.id;
		await admin.from('profiles').update({ bio: `Loves ${token} music`, discoverable: true }).eq('id', userId);

		const { data: post, error: postErr } = await admin
			.from('posts')
			.insert({ author_id: userId, body: `<p>Check out my ${token} track</p>`, tags: [] })
			.select('id')
			.single();
		if (postErr) throw postErr;
		postId = post.id;

		const { data: venue, error: venueErr } = await admin
			.from('venues')
			.insert({ name: `${token} Lounge`, city: 'Testville', lat: 0, lng: 0 })
			.select('id')
			.single();
		if (venueErr) throw venueErr;
		venueId = venue.id;
	});

	afterAll(async () => {
		if (postId) await admin.from('posts').delete().eq('id', postId);
		if (venueId) await admin.from('venues').delete().eq('id', venueId);
		if (userId) await cleanupUser(userId);
	});

	it('returns empty results for a query shorter than 2 characters', async () => {
		const res = await callRoute(() => searchRoute.GET(eventFor('a')));
		expect(await res.json()).toEqual({ profiles: [], posts: [], venues: [] });
	});

	it('finds a post by its body text, with HTML stripped from the match', async () => {
		const res = await callRoute(() => searchRoute.GET(eventFor(token)));
		const json = await res.json();
		expect(json.posts.some((p: any) => p.id === postId)).toBe(true);
	});

	it('finds a profile by its bio text', async () => {
		const res = await callRoute(() => searchRoute.GET(eventFor(token)));
		const json = await res.json();
		expect(json.profiles.some((p: any) => p.id === userId)).toBe(true);
	});

	it('finds a venue by name', async () => {
		const res = await callRoute(() => searchRoute.GET(eventFor(token)));
		const json = await res.json();
		expect(json.venues.some((v: any) => v.id === venueId)).toBe(true);
	});

	it('does not match an unrelated term', async () => {
		const res = await callRoute(() => searchRoute.GET(eventFor('zzznonexistentqueryxyz')));
		const json = await res.json();
		expect(json.posts).toHaveLength(0);
		expect(json.profiles).toHaveLength(0);
		expect(json.venues).toHaveLength(0);
	});
});
