// Integration tests: exercise the membership API route and the Postgres RLS
// policies together against a real Supabase project.
//
// These create and delete real auth users, so they must point at a dedicated
// TEST project, never the production database. They are skipped unless all
// TEST_SUPABASE_* variables are set.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import * as membershipRoute from '../../src/routes/api/bands/[id]/membership/+server';

const SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(SUPABASE_URL && ANON && SERVICE);
const PASSWORD = 'IntegrationTest!123';

type Actor = { user: User; client: SupabaseClient };

async function actorFor(admin: SupabaseClient, email: string): Promise<Actor> {
	const signIn = createClient(SUPABASE_URL!, ANON!, { auth: { persistSession: false } });
	const { data, error } = await signIn.auth.signInWithPassword({ email, password: PASSWORD });
	if (error || !data.session) throw error ?? new Error('no session');
	// A client that sends the user's JWT, so auth.uid() inside RLS is this user.
	const client = createClient(SUPABASE_URL!, ANON!, {
		auth: { persistSession: false },
		global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
	});
	return { user: data.user, client };
}

function eventFor(
	actor: Actor,
	params: Record<string, string>,
	init?: { method?: string; body?: unknown; search?: string }
) {
	const url = new URL(`http://test.local/api/bands/x/membership${init?.search ?? ''}`);
	const request = new Request(url, {
		method: init?.method ?? 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: init?.body ? JSON.stringify(init.body) : undefined
	});
	return {
		params,
		url,
		request,
		locals: {
			supabase: actor.client,
			safeGetSession: async () => ({ user: actor.user, session: null })
		}
	} as any;
}

describe.skipIf(!configured)('band membership (integration)', () => {
	const admin = configured ? createClient(SUPABASE_URL!, SERVICE!, { auth: { persistSession: false } }) : (null as any);
	const stamp = Date.now();
	let band: Actor;
	let personal: Actor;
	let other: Actor;
	const created: string[] = [];

	async function makeUser(label: string) {
		const email = `it-${label}-${stamp}@openmic-seed.test`;
		const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
		if (error) throw error;
		created.push(data.user.id);
		// The on-signup trigger creates the profile row; wait briefly for it.
		await new Promise((r) => setTimeout(r, 800));
		return { email, id: data.user.id };
	}

	beforeAll(async () => {
		const b = await makeUser('band');
		const p = await makeUser('member');
		const o = await makeUser('outsider');
		await admin.from('profiles').update({ is_band: true, full_name: 'IT Band' }).eq('id', b.id);
		band = await actorFor(admin, b.email);
		personal = await actorFor(admin, p.email);
		other = await actorFor(admin, o.email);
	});

	afterAll(async () => {
		for (const id of created) {
			await admin.from('band_memberships').delete().or(`band_id.eq.${id},member_id.eq.${id}`);
			await admin.auth.admin.deleteUser(id);
		}
	});

	it('lets an artist request to join a band', async () => {
		const res = await membershipRoute.POST(eventFor(personal, { id: band.user.id }, { method: 'POST' }) as any);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: 'pending' });
	});

	it('refuses a request to a non-band account', async () => {
		const res = await membershipRoute.POST(eventFor(other, { id: personal.user.id }, { method: 'POST' }) as any);
		expect(res.status).toBe(400);
	});

	it('refuses requests from people who are not signed in', async () => {
		const event = eventFor(personal, { id: band.user.id }, { method: 'POST' }) as any;
		event.locals.safeGetSession = async () => ({ user: null, session: null });
		const res = await membershipRoute.POST(event);
		expect(res.status).toBe(401);
	});

	it('stops a non-owner from accepting a member', async () => {
		const res = await membershipRoute.PATCH(
			eventFor(personal, { id: band.user.id }, { body: { member_id: personal.user.id } }) as any
		);
		expect(res.status).toBe(403);
	});

	it('lets the band account accept a pending request', async () => {
		const res = await membershipRoute.PATCH(
			eventFor(band, { id: band.user.id }, { body: { member_id: personal.user.id } }) as any
		);
		expect(res.status).toBe(200);
		const { data } = await admin
			.from('band_memberships').select('status').eq('band_id', band.user.id).eq('member_id', personal.user.id).single();
		expect(data?.status).toBe('accepted');
	});

	it('lets a member leave the band', async () => {
		const res = await membershipRoute.DELETE(eventFor(personal, { id: band.user.id }, { method: 'DELETE' }) as any);
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

