import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PRIVATE_ADMIN_EMAIL } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user || user.email !== PRIVATE_ADMIN_EMAIL) throw error(403, 'Forbidden');

	const admin = supabaseAdmin();
	const { data: claims, error: queryError } = await admin
		.from('venue_claims')
		.select(
			'id, role, note, status, created_at, venue:venues(id, name, website, address, city), claimant:profiles!claimant_id(id, full_name)'
		)
		.eq('status', 'pending')
		.order('created_at', { ascending: true });

	if (queryError) throw error(500, queryError.message);

	return { claims: claims ?? [] };
};
