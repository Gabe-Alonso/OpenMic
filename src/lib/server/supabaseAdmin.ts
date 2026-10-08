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
// production. Preferring those vars here, when present, keeps this client
// pointed at the same project as the rest of a test run — they're never set
// in any real deployment (production, or Vercel preview, which points its
// own PUBLIC_SUPABASE_URL at the test project directly instead), so this
// only changes behavior under test.
const SUPABASE_URL = env.TEST_SUPABASE_URL || PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.TEST_SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
	if (!client) client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
	return client;
}
