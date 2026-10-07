// Integration tests: exercise the membership API route and the Postgres RLS
// policies together against a real Supabase project. See helpers.ts for how
// and why.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as membershipRoute from '../../src/routes/api/bands/[id]/membership/+server';
import { configured, admin, actorFor, makeUser, cleanupUser, buildEvent, callRoute, type Actor } from './helpers';

function eventFor(actor: Actor | null, params: Record<string, string>, init?: { method?: string; body?: unknown; search?: string }) {
	return buildEvent(actor, params, { ...init, path: `/api/bands/x/membership${init?.search ?? ''}` });
}

describe.skipIf(!configured)('band membership (integration)', () => {
	let band: Actor;
	let personal: Actor;
	let other: Actor;
	const created: string[] = [];

	beforeAll(async () => {
		const b = await makeUser('band', true);
		const p = await makeUser('member', false);
		const o = await makeUser('outsider', false);
		created.push(b.id, p.id, o.id);
		band = await actorFor(b.email);
		personal = await actorFor(p.email);
		other = await actorFor(o.email);
	});

	afterAll(async () => {
		for (const id of created) await cleanupUser(id);
	});

	it('lets an artist request to join a band', async () => {
		const res = await callRoute(() => membershipRoute.POST(eventFor(personal, { id: band.user.id }, { method: 'POST' })));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: 'pending' });
	});

	it('refuses a request to a non-band account', async () => {
		const res = await callRoute(() => membershipRoute.POST(eventFor(other, { id: personal.user.id }, { method: 'POST' })));
		expect(res.status).toBe(400);
	});

	it('refuses requests from people who are not signed in', async () => {
		const res = await callRoute(() => membershipRoute.POST(eventFor(null, { id: band.user.id }, { method: 'POST' })));
		expect(res.status).toBe(401);
	});

	it('stops a non-owner from accepting a member', async () => {
		const res = await callRoute(() => membershipRoute.PATCH(
			eventFor(personal, { id: band.user.id }, { body: { member_id: personal.user.id } })
		));
		expect(res.status).toBe(403);
	});

	it('lets the band account accept a pending request', async () => {
		const res = await callRoute(() => membershipRoute.PATCH(
			eventFor(band, { id: band.user.id }, { body: { member_id: personal.user.id } })
		));
		expect(res.status).toBe(200);
		const { data } = await admin
			.from('band_memberships').select('status').eq('band_id', band.user.id).eq('member_id', personal.user.id).single();
		expect(data?.status).toBe('accepted');
	});

	it('lets a member leave the band', async () => {
		const res = await callRoute(() => membershipRoute.DELETE(eventFor(personal, { id: band.user.id }, { method: 'DELETE' })));
		expect(res.status).toBe(200);
		const { data } = await admin.from('band_memberships').select('id').eq('band_id', band.user.id).eq('member_id', personal.user.id);
		expect(data).toHaveLength(0);
	});

	it('blocks a direct database insert that skips the join flow', async () => {
		// RLS, not just the route: a user cannot write a membership as someone else.
		const { error } = await other.client
			.from('band_memberships')
			.insert({ band_id: band.user.id, member_id: personal.user.id, status: 'accepted' });
		expect(error).not.toBeNull();
	});
});
