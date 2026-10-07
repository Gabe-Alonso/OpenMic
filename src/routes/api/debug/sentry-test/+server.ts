// Temporary: hit this once after setting PUBLIC_SENTRY_DSN to confirm errors
// actually reach Sentry, then delete this file.
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	throw new Error('Sentry wiring test — safe to ignore, this route is being removed');
};
