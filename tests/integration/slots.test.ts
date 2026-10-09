// Integration tests: slot applications, private offers, and the
// accept/reject/accept-offer/decline-offer/cancel-offer transitions. These
// call the +page.server.ts actions directly (same approach as
// venue-claims.test.ts), since the admin-only parts of this feature (none,
// here — unlike venue claims and reports, nothing in this flow is gated by
// PRIVATE_ADMIN_EMAIL) aren't a concern.
//
// The security-definer RPC functions (accept_slot_application,
// create_slot_offer, accept_slot_offer, decline_slot_offer,
// cancel_slot_offer) are exercised indirectly through the actions that call
// them, which is what actually matters: that the right person can trigger
// the right transition, and that a locked slot's row (status,
// artist_profile_id) ends up correct, not just that the action "succeeded".

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { actions as manageActions } from '../../src/routes/profile/events/[eventId]/+page.server';
import { actions as publicActions } from '../../src/routes/profile/[id]/+page.server';
import { actions as offerActions } from '../../src/routes/offers/[offerId]/+page.server';
import { configured, admin, anon, actorFor, makeUser, cleanupUser, type Actor } from './helpers';

describe.skipIf(!configured)('event slots, applications, and private offers (integration)', () => {
	let venue: Actor;
	let otherVenue: Actor;
	let artistA: Actor;
	let artistB: Actor;
	let artistC: Actor;
	let artistD: Actor;
	const createdUsers: string[] = [];
	let eventId: string;

	function formAction(fn: (event: any) => any, actor: Actor | null, params: Record<string, string>, fields: Record<string, string>) {
		const url = new URL(`http://test.local/x`);
		const request = new Request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields).toString()
		});
		const event = {
			params,
			url,
			request,
			locals: {
				supabase: actor?.client ?? anon,
				safeGetSession: async () => ({ user: actor?.user ?? null, session: null })
			}
		} as any;
		return fn(event) as Promise<any>;
	}

	async function addSlot(): Promise<string> {
		const result = await formAction(manageActions.addSlot, venue, { eventId }, { start_time: '20:00', end_time: '20:30' });
		expect(result.slotAdded).toBe(true);
		const { data } = await admin.from('event_slots').select('id').eq('event_id', eventId).order('created_at', { ascending: false }).limit(1).single();
		return data!.id as string;
	}

	beforeAll(async () => {
		const v = await makeUser('slots-venue', false);
		const ov = await makeUser('slots-other-venue', false);
		const a = await makeUser('slots-artist-a', false);
		const b = await makeUser('slots-artist-b', false);
		const c = await makeUser('slots-artist-c', false);
		const d = await makeUser('slots-artist-d', false);
		createdUsers.push(v.id, ov.id, a.id, b.id, c.id, d.id);
		venue = await actorFor(v.email);
		otherVenue = await actorFor(ov.email);
		artistA = await actorFor(a.email);
		artistB = await actorFor(b.email);
		artistC = await actorFor(c.email);
		artistD = await actorFor(d.email);

		const { data: event, error } = await admin
			.from('venue_events')
			.insert({ profile_id: venue.user.id, title: 'Slots Test Night', date: '2026-01-01' })
			.select('id')
			.single();
		if (error) throw error;
		eventId = event.id;
	});

	afterAll(async () => {
		await admin.from('venue_events').delete().eq('id', eventId);
		for (const id of createdUsers) await cleanupUser(id);
	});

	it('lets the venue owner add a slot', async () => {
		const slotId = await addSlot();
		const { data: slot } = await admin.from('event_slots').select('status').eq('id', slotId).single();
		expect(slot?.status).toBe('open');
	});

	it('posts a feed announcement, authored by the venue, when a slot opens', async () => {
		await addSlot();
		const { data: post } = await admin
			.from('posts')
			.select('author_id, body')
			.eq('author_id', venue.user.id)
			.order('created_at', { ascending: false })
			.limit(1)
			.single();
		expect(post?.author_id).toBe(venue.user.id);
		expect(post?.body).toContain('Slots Test Night');
	});

	it("refuses a non-owner venue adding a slot to someone else's event", async () => {
		const result = await formAction(manageActions.addSlot, otherVenue, { eventId }, { start_time: '21:00' });
		expect(result.status).toBe(404);
	});

	describe('applications', () => {
		let slotId: string;

		beforeAll(async () => {
			slotId = await addSlot();
		});

		it('lets an artist apply with a message', async () => {
			const result = await formAction(publicActions.applyToSlot, artistA, { id: venue.user.id }, { slot_id: slotId, message: 'Would love to play!' });
			expect(result.applied).toBe(true);
			const { data } = await admin.from('slot_applications').select('status, message').eq('slot_id', slotId).eq('artist_profile_id', artistA.user.id).single();
			expect(data?.status).toBe('pending');
			expect(data?.message).toBe('Would love to play!');
		});

		it('refuses a second application from the same artist to the same slot', async () => {
			const result = await formAction(publicActions.applyToSlot, artistA, { id: venue.user.id }, { slot_id: slotId });
			expect(result.status).toBe(400);
		});

		it('lets a second artist apply too', async () => {
			const result = await formAction(publicActions.applyToSlot, artistB, { id: venue.user.id }, { slot_id: slotId });
			expect(result.applied).toBe(true);
		});

		it('lets the venue reject one applicant without affecting the others', async () => {
			const { data: app } = await admin.from('slot_applications').select('id').eq('slot_id', slotId).eq('artist_profile_id', artistB.user.id).single();
			const result = await formAction(manageActions.rejectApplication, venue, { eventId }, { application_id: app!.id });
			expect(result.applicationRejected).toBe(true);
			const { data: rejected } = await admin.from('slot_applications').select('status').eq('id', app!.id).single();
			expect(rejected?.status).toBe('rejected');
			const { data: stillPending } = await admin.from('slot_applications').select('status').eq('slot_id', slotId).eq('artist_profile_id', artistA.user.id).single();
			expect(stillPending?.status).toBe('pending');
		});

		it("refuses a non-owner venue accepting someone else's applicant", async () => {
			const { data: app } = await admin.from('slot_applications').select('id').eq('slot_id', slotId).eq('artist_profile_id', artistA.user.id).single();
			const result = await formAction(manageActions.acceptApplication, otherVenue, { eventId }, { application_id: app!.id });
			expect(result.status).toBe(404);
		});

		it('lets the venue accept an applicant, locking the slot', async () => {
			const { data: app } = await admin.from('slot_applications').select('id').eq('slot_id', slotId).eq('artist_profile_id', artistA.user.id).single();
			const result = await formAction(manageActions.acceptApplication, venue, { eventId }, { application_id: app!.id });
			expect(result.applicationAccepted).toBe(true);

			const { data: slot } = await admin.from('event_slots').select('status, artist_profile_id').eq('id', slotId).single();
			expect(slot?.status).toBe('filled');
			expect(slot?.artist_profile_id).toBe(artistA.user.id);

			const { data: accepted } = await admin.from('slot_applications').select('status').eq('id', app!.id).single();
			expect(accepted?.status).toBe('accepted');
		});

		it('refuses a new application once the slot is filled', async () => {
			const result = await formAction(publicActions.applyToSlot, artistC, { id: venue.user.id }, { slot_id: slotId });
			expect(result.status).toBe(400);
		});
	});

	describe('private offers', () => {
		it('reserves the slot and blocks public applications while an offer is pending', async () => {
			const slotId = await addSlot();
			const sendResult = await formAction(manageActions.sendOffer, venue, { eventId }, { slot_id: slotId, artist_id: artistC.user.id, message: 'You in?' });
			expect(sendResult.offerSent).toBe(true);

			const { data: slot } = await admin.from('event_slots').select('status').eq('id', slotId).single();
			expect(slot?.status).toBe('reserved');

			const applyResult = await formAction(publicActions.applyToSlot, artistD, { id: venue.user.id }, { slot_id: slotId });
			expect(applyResult.status).toBe(400);
		});

		it("refuses a non-owner venue sending an offer on someone else's slot", async () => {
			const slotId = await addSlot();
			const result = await formAction(manageActions.sendOffer, otherVenue, { eventId }, { slot_id: slotId, artist_id: artistC.user.id });
			expect(result.status).toBe(404);
		});

		it('refuses the wrong artist accepting an offer', async () => {
			const slotId = await addSlot();
			await formAction(manageActions.sendOffer, venue, { eventId }, { slot_id: slotId, artist_id: artistC.user.id });
			const { data: offer } = await admin.from('slot_offers').select('id').eq('slot_id', slotId).eq('status', 'pending').single();

			const result = await formAction(offerActions.accept, artistD, { offerId: offer!.id }, {});
			expect(result.status).toBe(400);
		});

		it('lets the invited artist decline, reopening the slot', async () => {
			const slotId = await addSlot();
			await formAction(manageActions.sendOffer, venue, { eventId }, { slot_id: slotId, artist_id: artistC.user.id });
			const { data: offer } = await admin.from('slot_offers').select('id').eq('slot_id', slotId).eq('status', 'pending').single();

			const result = await formAction(offerActions.decline, artistC, { offerId: offer!.id }, {});
			expect(result.decided).toBe(true);
			expect(result.accepted).toBe(false);

			const { data: slot } = await admin.from('event_slots').select('status').eq('id', slotId).single();
			expect(slot?.status).toBe('open');
			const { data: declined } = await admin.from('slot_offers').select('status').eq('id', offer!.id).single();
			expect(declined?.status).toBe('declined');
		});

		it('lets the invited artist accept, locking the slot', async () => {
			const slotId = await addSlot();
			await formAction(manageActions.sendOffer, venue, { eventId }, { slot_id: slotId, artist_id: artistD.user.id });
			const { data: offer } = await admin.from('slot_offers').select('id').eq('slot_id', slotId).eq('status', 'pending').single();

			const result = await formAction(offerActions.accept, artistD, { offerId: offer!.id }, {});
			expect(result.decided).toBe(true);
			expect(result.accepted).toBe(true);

			const { data: slot } = await admin.from('event_slots').select('status, artist_profile_id').eq('id', slotId).single();
			expect(slot?.status).toBe('filled');
			expect(slot?.artist_profile_id).toBe(artistD.user.id);
		});

		it('lets the venue cancel a pending offer, reopening the slot', async () => {
			const slotId = await addSlot();
			await formAction(manageActions.sendOffer, venue, { eventId }, { slot_id: slotId, artist_id: artistC.user.id });
			const { data: offer } = await admin.from('slot_offers').select('id').eq('slot_id', slotId).eq('status', 'pending').single();

			const result = await formAction(manageActions.cancelOffer, venue, { eventId }, { offer_id: offer!.id });
			expect(result.offerCancelled).toBe(true);

			const { data: slot } = await admin.from('event_slots').select('status').eq('id', slotId).single();
			expect(slot?.status).toBe('open');
			const { data: cancelled } = await admin.from('slot_offers').select('status').eq('id', offer!.id).single();
			expect(cancelled?.status).toBe('cancelled');
		});

		it('blocks a direct RPC call accepting an offer that is not pending', async () => {
			const slotId = await addSlot();
			await formAction(manageActions.sendOffer, venue, { eventId }, { slot_id: slotId, artist_id: artistC.user.id });
			const { data: offer } = await admin.from('slot_offers').select('id').eq('slot_id', slotId).eq('status', 'pending').single();
			await formAction(offerActions.decline, artistC, { offerId: offer!.id }, {});

			const { error } = await artistC.client.rpc('accept_slot_offer', { p_offer_id: offer!.id });
			expect(error).not.toBeNull();
		});
	});
});
