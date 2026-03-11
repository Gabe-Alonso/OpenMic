import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: `${url.origin}/auth/callback`
		}
	});

	if (error || !data.url) throw redirect(303, '/signin');
	throw redirect(303, data.url);
};
