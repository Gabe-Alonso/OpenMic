// Integration tests: the venue claim submission action. The admin
// approve/reject routes aren't covered here — they import PRIVATE_ADMIN_EMAIL
// via $env/static/private, which (like every other PRIVATE_ADMIN_EMAIL-gated
// admin route in this app) isn't a secret set in the integration CI job, only
// in local dev — same reason admin/reports has never been integration-tested
// either. This submission action imports no such thing, so it's fully
// testable.
//
// Unlike every other test in this suite, this one calls a +page.server.ts
// form *action* directly rather than a +server.ts route handler, so
// helpers.ts's callRoute() (built for Response-returning handlers) doesn't
// apply: an action either returns the plain success object directly, or
// fail(status, data) — which, called outside SvelteKit's own request
// pipeline, resolves to a plain {status, data} object rather than throwing.
// See helpers.ts for why these run against a real test project, not mocks.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { actions } from '../../src/routes/venues/[id]/claim/+page.server';
import { configured, admin, anon, actorFor, makeUser, cleanupUser, type Actor } from './helpers';

describe.skipIf(!configured)('venue claims (integration)', () => {
	let claimant: Actor;
	let other: Actor;
	const created: string[] = [];
	let matchingVenueId: string;
	let plainVenueId: string;

	beforeAll(async () => {
		const c = await makeUser('claim-claimant', false);
		const o = await makeUser('claim-other', false);
		created.push(c.id, o.id);
		claimant = await actorFor(c.email);
		other = await actorFor(o.email);

		// claimant's seeded email is it-claim-claimant-<unique>@openmic-seed.test —
		// give one venue a matching website domain, and one with an unrelated one.
		const emailDomain = claimant.user.email!.split('@')[1];
		const { data: matching, error: e1 } = await admin
			.from('venues')
			.insert({ name: 'Domain Match Venue', lat: 30.27, lng: -97.74, website: `https://${emailDomain}` })
			.select('id')
			.single();
		if (e1) throw e1;
		matchingVenueId = matching.id;

		const { data: plain, error: e2 } = await admin
			.from('venues')
			.insert({ name: 'Plain Venue', lat: 30.27, lng: -97.74, website: 'https://unrelated-domain.test' })
			.select('id')
			.single();
		if (e2) throw e2;
		plainVenueId = plain.id;
	});

	afterAll(async () => {
		await admin.from('venue_claims').delete().in('venue_id', [matchingVenueId, plainVenueId]);
		await admin.from('venues').delete().in('id', [matchingVenueId, plainVenueId]);
		for (const id of created) await cleanupUser(id);
	});

	// actions.default reads request.formData(), unlike the +server.ts routes
	// every other test in this suite targets (which read request.json()) —
	// buildEvent's JSON body doesn't apply here, so this builds a real
	// form-encoded request instead.
	function submitClaim(actor: Actor | null, venueId: string, fields: Record<string, string>) {
		const url = new URL(`http://test.local/venues/${venueId}/claim`);
		const request = new Request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields).toString()
		});
		const event = {
			params: { id: venueId },
			url,
			request,
			locals: {
				supabase: actor?.client ?? anon,
				safeGetSession: async () => ({ user: actor?.user ?? null, session: null })
			}
		} as any;
		return actions.default(event) as Promise<any>;
	}

	it('refuses an unauthenticated submission', async () => {
		const result = await submitClaim(null, matchingVenueId, { role: 'owner' });
		expect(result.status).toBe(401);
	});

	it('rejects an invalid role', async () => {
		const result = await submitClaim(claimant, matchingVenueId, { role: 'king' });
		expect(result.status).toBe(400);
	});

	it('auto-approves when the claimant email domain matches the venue website', async () => {
		const result = await submitClaim(claimant, matchingVenueId, { role: 'owner', note: "It's me" });
		expect(result.status).toBeUndefined();
		expect(result.claimSubmitted).toBe(true);
		expect(result.approved).toBe(true);

		const { data: venue } = await admin.from('venues').select('claimed_profile_id').eq('id', matchingVenueId).single();
		expect(venue?.claimed_profile_id).toBe(claimant.user.id);

		const { data: claimRow } = await admin
			.from('venue_claims')
			.select('status, auto_approved')
			.eq('venue_id', matchingVenueId)
			.eq('claimant_id', claimant.user.id)
			.single();
		expect(claimRow?.status).toBe('approved');
		expect(claimRow?.auto_approved).toBe(true);
	});

	it('refuses to claim a venue that is already claimed', async () => {
		const result = await submitClaim(other, matchingVenueId, { role: 'owner' });
		expect(result.status).toBe(400);
	});

	it('falls back to a pending claim when the domain does not match', async () => {
		const result = await submitClaim(other, plainVenueId, { role: 'manager' });
		expect(result.status).toBeUndefined();
		expect(result.claimSubmitted).toBe(true);
		expect(result.approved).toBe(false);

		const { data: venue } = await admin.from('venues').select('claimed_profile_id').eq('id', plainVenueId).single();
		expect(venue?.claimed_profile_id).toBeNull();

		const { data: claimRow } = await admin
			.from('venue_claims')
			.select('status')
			.eq('venue_id', plainVenueId)
			.eq('claimant_id', other.user.id)
			.single();
		expect(claimRow?.status).toBe('pending');
	});

	it('refuses a second pending claim on the same venue by the same person', async () => {
		const result = await submitClaim(other, plainVenueId, { role: 'manager' });
		expect(result.status).toBe(400);
	});

	it("blocks a direct database insert that impersonates another claimant", async () => {
		const { data, error } = await other.client
			.from('venue_claims')
			.insert({ venue_id: plainVenueId, claimant_id: claimant.user.id, role: 'owner' })
			.select();
		expect(data ?? []).toHaveLength(0);
		expect(error).not.toBeNull();
	});
});
