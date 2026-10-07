import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';

// See src/hooks.server.ts for why this reads the DSN dynamically rather than
// from $env/static/public.
if (env.PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: env.PUBLIC_SENTRY_DSN,
		environment: dev ? 'development' : 'production',
		tracesSampleRate: 0.2,
		integrations: [Sentry.browserTracingIntegration(), Sentry.consoleLoggingIntegration()]
	});
}

export const handleError = Sentry.handleErrorWithSentry();
