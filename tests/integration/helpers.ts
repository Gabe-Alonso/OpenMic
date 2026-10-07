// Shared fixtures for the integration suite. These tests create and delete real
// auth users against a dedicated TEST Supabase project, never production, and
// skip entirely when TEST_SUPABASE_* is not configured (see `configured`).

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

export const configured = Boolean(SUPABASE_URL && ANON && SERVICE);
export const PASSWORD = 'IntegrationTest!123';

export type Actor = { user: User; client: SupabaseClient };

// Service-role client: bypasses RLS, used only for setup/teardown and for
// reading back the "true" state of a row to check what an actor's own
// request actually did to it.
export const admin: SupabaseClient = configured
	? createClient(SUPABASE_URL!, SERVICE!, { auth: { persistSession: false } })
	: (null as any);

// A real, sessionless anon-key client — what an unauthenticated request's
// locals.supabase actually is in the app, as opposed to undefined. Only
// matters for routes that touch supabase without requiring a signed-in user
// (e.g. public search); routes that return early on `!user` never reach it.
export const anon: SupabaseClient = configured
	? createClient(SUPABASE_URL!, ANON!, { auth: { persistSession: false } })
	: (null as any);

// Signs a user in and returns a client that sends their JWT, so auth.uid()
// inside RLS resolves to this user, exactly as it would for a real request.
export async function actorFor(email: string): Promise<Actor> {
	const signIn = createClient(SUPABASE_URL!, ANON!, { auth: { persistSession: false } });
	const { data, error } = await signIn.auth.signInWithPassword({ email, password: PASSWORD });
	if (error || !data.session) throw error ?? new Error('no session');
	const client = createClient(SUPABASE_URL!, ANON!, {
		auth: { persistSession: false },
		global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
	});
	return { user: data.user, client };
}

// Creates an auth user and its profile row explicitly, rather than relying on
// the signup trigger, and fails loudly if either step does not work.
export async function makeUser(label: string, isBand = false): Promise<{ email: string; id: string }> {
	const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	const email = `it-${label}-${unique}@openmic-seed.test`;
	const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
	if (error) throw error;
	const { error: profileError } = await admin
		.from('profiles')
		.upsert({ id: data.user.id, full_name: `IT ${label}`, is_band: isBand });
	if (profileError) throw profileError;
	return { email, id: data.user.id };
}

export async function cleanupUser(id: string) {
	await admin.from('band_memberships').delete().or(`band_id.eq.${id},member_id.eq.${id}`);
	await admin.auth.admin.deleteUser(id);
}

// Some routes return `json(..., { status })` on every path; others use
// SvelteKit's `error(status, message)` helper, which *throws* rather than
// returning a Response. Calling a route directly (outside SvelteKit's own
// request pipeline, which normally catches that throw and turns it into a
// response) means callers have to handle both styles. This normalizes them
// into one shape so a test can assert on `.status` either way.
export async function callRoute(fn: () => Response | Promise<Response>): Promise<{ status: number; json: () => Promise<any> }> {
	try {
		const res = await fn();
		return { status: res.status, json: () => res.json() };
	} catch (err: any) {
		if (typeof err?.status !== 'number') throw err;
		return { status: err.status, json: async () => err.body };
	}
}

// Builds a minimal RequestEvent-shaped object so a +server.ts handler can be
// called directly, the same way SvelteKit would call it for a real request.
export function buildEvent(
	actor: Actor | null,
	params: Record<string, string>,
	init?: { method?: string; body?: unknown; path?: string }
) {
	const url = new URL(`http://test.local${init?.path ?? '/api'}`);
	const request = new Request(url, {
		method: init?.method ?? 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: init?.body !== undefined ? JSON.stringify(init.body) : undefined
	});
	return {
		params,
		url,
		request,
		locals: {
			supabase: actor?.client ?? anon,
			safeGetSession: async () => ({ user: actor?.user ?? null, session: null })
		}
	} as any;
}
