import * as Sentry from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';

// PUBLIC_SENTRY_DSN is read dynamically, not from $env/static/public like the
// other PUBLIC_ vars here, so the app (and svelte-check) keeps working for
// anyone who hasn't set up a Sentry project yet — error reporting is an
// enhancement, not something the app should hard-require to boot.
if (env.PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: env.PUBLIC_SENTRY_DSN,
		environment: dev ? 'development' : 'production',
		tracesSampleRate: 0.2,
		integrations: [Sentry.consoleLoggingIntegration()]
	});
}

const supabaseHandle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll() {
				return event.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) =>
					event.cookies.set(name, value, { ...options, path: '/' })
				);
			}
		}
	});

	// getUser() validates the JWT by contacting Supabase's servers on every call —
	// this is the secure approach. getSession() only reads cookies and should not
	// be used for auth decisions on the server.
	event.locals.safeGetSession = async () => {
		const { data: { user }, error } = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };
		return { session: null, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

export const handle = sequence(Sentry.sentryHandle(), supabaseHandle);
export const handleError = Sentry.handleErrorWithSentry();
