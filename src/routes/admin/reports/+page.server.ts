import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PRIVATE_ADMIN_EMAIL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user || user.email !== PRIVATE_ADMIN_EMAIL) throw error(403, 'Forbidden');

	const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
	const { data: reports, error: queryError } = await admin
		.from('reports')
		.select(
			// reports has two FKs into profiles (reporter_id, reviewed_by), so the
			// embed needs an explicit !hint naming which column to join through —
			// plain `reporter_id(...)` isn't valid embed syntax at all (it names a
			// column, not a relation) and throws rather than returning a clean error.
			'id, post_id, reason, details, status, created_at, reporter:profiles!reporter_id(id, full_name), post:posts(id, body, author_id, profiles(id, full_name))'
		)
		.eq('status', 'pending')
		.order('created_at', { ascending: true });

	if (queryError) throw error(500, queryError.message);

	return { reports: reports ?? [] };
};
