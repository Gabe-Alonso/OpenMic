import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_ADMIN_EMAIL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

export const GET: RequestHandler = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');
	if (user.email !== PRIVATE_ADMIN_EMAIL) throw error(403, 'Forbidden');

	const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const { data, error: queryError } = await admin
		.from('reports')
		.select(
			'id, post_id, reason, details, status, created_at, reporter:reporter_id(id, full_name), post:post_id(id, body, author_id, profiles(id, full_name))'
		)
		.eq('status', 'pending')
		.order('created_at', { ascending: true });

	if (queryError) throw error(500, queryError.message);

	return json(data ?? []);
};
