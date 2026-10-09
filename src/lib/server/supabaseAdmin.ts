import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

// Shared service-role client for server-only code that needs to bypass RLS
// (looking up another user's auth email, writing notifications on someone
// else's behalf, etc.) — the same credentials the admin routes already each
// created their own client with, just memoized in one place.
//
// The integration test harness points its own actors at a dedicated test
// project via TEST_SUPABASE_* (see tests/integration/helpers.ts), never at
// production, and this client needs to land in the same project as the rest
// of a test run. But gating this purely on "are TEST_SUPABASE_* set" was
// wrong: local .env has them too (for convenience running integration tests
// locally), and `npm run dev` loads the same .env file vitest does — so that
// version of this fix silently misdirected every admin-client write during
// local dev as well, not just test runs, with no error (just 0 rows affected
// against whichever project didn't have the row). Real deployments were
// never at risk (Vercel never sets TEST_SUPABASE_*), only local manual
// testing was. Gating on `process.env.VITEST` — set automatically by vitest,
// never by `vite dev` or a real deployment — actually scopes this to test
// runs only.
const underTest = process.env.VITEST === 'true';
const SUPABASE_URL = (underTest && env.TEST_SUPABASE_URL) || PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = (underTest && env.TEST_SUPABASE_SERVICE_ROLE_KEY) || SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
	if (!client) client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
	return client;
}
