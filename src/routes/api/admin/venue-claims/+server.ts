import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_ADMIN_EMAIL } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

export const GET: RequestHandler = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');
	if (user.email !== PRIVATE_ADMIN_EMAIL) throw error(403, 'Forbidden');

	const admin = supabaseAdmin();

	const { data, error: queryError } = await admin
		.from('venue_claims')
		.select(
			'id, role, note, status, created_at, venue:venues(id, name, website, address, city), claimant:profiles!claimant_id(id, full_name)'
		)
		.eq('status', 'pending')
		.order('created_at', { ascending: true });

	if (queryError) throw error(500, queryError.message);

	return json(data ?? []);
};
