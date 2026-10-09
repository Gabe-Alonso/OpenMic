// Integration tests: the venue ratings/reviews API — both the route-level
// behavior and, for the impersonation case, the raw RLS policy underneath
// it. Covers both of the dual target columns (a registered venue profile
// and a seeded venues-table row), since that's the one genuinely tricky
// part of this feature's design. See helpers.ts for why these run against
// a real test project, not mocks.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as ratingsRoute from '../../src/routes/api/venue-ratings/+server';
import * as ratingRoute from '../../src/routes/api/venue-ratings/[id]/+server';
import { configured, admin, actorFor, makeUser, cleanupUser, buildEvent, callRoute, type Actor } from './helpers';

function eventFor(actor: Actor | null, query: string, init: { method: string; body?: unknown; path?: string }) {
	return buildEvent(actor, {}, { ...init, path: `/api/venue-ratings${query}` });
}

describe.skipIf(!configured)('venue ratings (integration)', () => {
	let venueOwner: Actor;
	let reviewer: Actor;
	let other: Actor;
	let seededVenueId: string;
	const created: string[] = [];

	beforeAll(async () => {
		const v = await makeUser('rating-venue', false);
		const r = await makeUser('rating-reviewer', false);
		const o = await makeUser('rating-other', false);
		created.push(v.id, r.id, o.id);
		await admin.from('profiles').update({ profile_type: 'venue' }).eq('id', v.id);
		venueOwner = await actorFor(v.email);
		reviewer = await actorFor(r.email);
		other = await actorFor(o.email);

		const { data: venue, error } = await admin
			.from('venues')
			.insert({ name: 'Rating Test Venue', lat: 30.27, lng: -97.74 })
			.select('id')
			.single();
		if (error) throw error;
		seededVenueId = venue.id;
	});

	afterAll(async () => {
		await admin.from('venue_ratings').delete().or(`venue_profile_id.eq.${venueOwner.user.id},seeded_venue_id.eq.${seededVenueId}`);
		if (seededVenueId) await admin.from('venues').delete().eq('id', seededVenueId);
		for (const id of created) await cleanupUser(id);
	});

	describe('rating a registered venue profile', () => {
		it('refuses an unauthenticated request', async () => {
			const res = await callRoute(() =>
				ratingsRoute.POST(eventFor(null, '', { method: 'POST', body: { venue_profile_id: venueOwner.user.id, rating: 4 } }))
			);
			expect(res.status).toBe(401);
		});

		it('rejects a rating that is not on a 0.5 step', async () => {
			const res = await callRoute(() =>
				ratingsRoute.POST(eventFor(reviewer, '', { method: 'POST', body: { venue_profile_id: venueOwner.user.id, rating: 3.3 } }))
			);
			expect(res.status).toBe(400);
		});

		it('rejects a rating outside 0-5', async () => {
			const res = await callRoute(() =>
				ratingsRoute.POST(eventFor(reviewer, '', { method: 'POST', body: { venue_profile_id: venueOwner.user.id, rating: 5.5 } }))
			);
			expect(res.status).toBe(400);
		});

		it('refuses to let the venue rate itself', async () => {
			const res = await callRoute(() =>
				ratingsRoute.POST(eventFor(venueOwner, '', { method: 'POST', body: { venue_profile_id: venueOwner.user.id, rating: 5 } }))
			);
			expect(res.status).toBe(400);
		});

		it('creates a rating with a comment, and reflects it in the average', async () => {
			const res = await callRoute(() =>
				ratingsRoute.POST(
					eventFor(reviewer, '', { method: 'POST', body: { venue_profile_id: venueOwner.user.id, rating: 4.5, comment: 'Great sound system' } })
				)
			);
			expect(res.status).toBe(200);

			const getRes = await callRoute(() =>
				ratingsRoute.GET(eventFor(reviewer, `?venue_profile_id=${venueOwner.user.id}`, { method: 'GET' }))
			);
			const json = await getRes.json();
			expect(json.average).toBe(4.5);
			expect(json.count).toBe(1);
			expect(json.reviews[0].comment).toBe('Great sound system');
			expect(json.myReview.rating).toBe(4.5);
		});

		it('upserts rather than duplicating when the same reviewer rates again', async () => {
			await callRoute(() =>
				ratingsRoute.POST(eventFor(reviewer, '', { method: 'POST', body: { venue_profile_id: venueOwner.user.id, rating: 3, comment: 'Updated take' } }))
			);
			const getRes = await callRoute(() =>
				ratingsRoute.GET(eventFor(reviewer, `?venue_profile_id=${venueOwner.user.id}`, { method: 'GET' }))
			);
			const json = await getRes.json();
			expect(json.count).toBe(1);
			expect(json.average).toBe(3);
			expect(json.reviews[0].comment).toBe('Updated take');
		});

		it("blocks a direct database insert that impersonates another reviewer", async () => {
			const { data, error } = await other.client
				.from('venue_ratings')
				.insert({ reviewer_id: reviewer.user.id, venue_profile_id: venueOwner.user.id, rating: 1 })
				.select();
			expect(data ?? []).toHaveLength(0);
			expect(error).not.toBeNull();
		});

		it('lets the reviewer delete their own review, scoped so a non-owner cannot', async () => {
			const { data: mine, error: mineError } = await admin
				.from('venue_ratings')
				.select('id')
				.eq('venue_profile_id', venueOwner.user.id)
				.eq('reviewer_id', reviewer.user.id)
				.single();
			if (mineError) throw mineError;

			const otherAttempt = await callRoute(() => ratingRoute.DELETE(buildEvent(other, { id: mine.id }, { method: 'DELETE' })));
			expect(otherAttempt.status).toBe(200); // route reports ok even when 0 rows match, same as other routes in this app
			const { data: stillThere } = await admin.from('venue_ratings').select('id').eq('id', mine.id).maybeSingle();
			expect(stillThere).not.toBeNull();

			const ownAttempt = await callRoute(() => ratingRoute.DELETE(buildEvent(reviewer, { id: mine.id }, { method: 'DELETE' })));
			expect(ownAttempt.status).toBe(200);
			const { data: goneNow } = await admin.from('venue_ratings').select('id').eq('id', mine.id).maybeSingle();
			expect(goneNow).toBeNull();
		});
	});

	describe('rating a seeded (unclaimed) venue', () => {
		it('creates a rating against the seeded_venue_id target', async () => {
			const res = await callRoute(() =>
				ratingsRoute.POST(eventFor(reviewer, '', { method: 'POST', body: { seeded_venue_id: seededVenueId, rating: 2.5 } }))
			);
			expect(res.status).toBe(200);

			const getRes = await callRoute(() => ratingsRoute.GET(eventFor(other, `?seeded_venue_id=${seededVenueId}`, { method: 'GET' })));
			const json = await getRes.json();
			expect(json.average).toBe(2.5);
			expect(json.count).toBe(1);
		});

		it('paginates with limit + cursor, newest first', async () => {
			await callRoute(() => ratingsRoute.POST(eventFor(other, '', { method: 'POST', body: { seeded_venue_id: seededVenueId, rating: 5 } })));

			const firstPage = await callRoute(() => ratingsRoute.GET(eventFor(null, `?seeded_venue_id=${seededVenueId}&limit=1`, { method: 'GET' })));
			const firstJson = await firstPage.json();
			expect(firstJson.reviews).toHaveLength(1);
			expect(firstJson.count).toBe(2);
			expect(firstJson.nextCursor).not.toBeNull();

			const secondPage = await callRoute(() =>
				ratingsRoute.GET(eventFor(null, `?seeded_venue_id=${seededVenueId}&limit=1&cursor=${firstJson.nextCursor}`, { method: 'GET' }))
			);
			const secondJson = await secondPage.json();
			expect(secondJson.reviews).toHaveLength(1);
			expect(secondJson.reviews[0].id).not.toBe(firstJson.reviews[0].id);
		});
	});
});
