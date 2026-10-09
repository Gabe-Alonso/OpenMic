import { error, json } from '@sveltejs/kit';
import { logger } from '@sentry/sveltekit';
import type { RequestHandler } from './$types';
import { PRIVATE_ADMIN_EMAIL } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { notify } from '$lib/server/notify';
import { venueClaimDecidedEmail } from '$lib/server/email';

export const PATCH: RequestHandler = async ({ params, request, url, locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');
	if (user.email !== PRIVATE_ADMIN_EMAIL) throw error(403, 'Forbidden');

	const { action } = await request.json();
	if (!['approve', 'reject'].includes(action)) throw error(400, 'Invalid action');

	const admin = supabaseAdmin();

	const { data: claim } = await admin
		.from('venue_claims')
		.select('id, venue_id, claimant_id, status, venue:venues(id, name, claimed_profile_id)')
		.eq('id', params.id)
		.maybeSingle();
	if (!claim) throw error(404, 'Claim not found');
	if (claim.status !== 'pending') throw error(400, 'This claim has already been decided');

	const venue = claim.venue as any;
	const approved = action === 'approve';

	if (approved && venue.claimed_profile_id) {
		throw error(400, 'This venue has already been claimed by someone else');
	}

	const { error: updateErr } = await admin
		.from('venue_claims')
		.update({ status: approved ? 'approved' : 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
		.eq('id', params.id);
	if (updateErr) throw error(500, updateErr.message);

	if (approved) {
		const { error: claimVenueErr } = await admin
			.from('venues')
			.update({ claimed_profile_id: claim.claimant_id })
			.eq('id', claim.venue_id)
			.is('claimed_profile_id', null);
		if (claimVenueErr) throw error(500, claimVenueErr.message);
	}

	const { subject, html } = venueClaimDecidedEmail(venue.name, approved, `${url.origin}/venues/${claim.venue_id}`);
	await notify(claim.claimant_id, 'venue_claim_decided', {
		inApp: {
			title: approved ? `Your claim on ${venue.name} was approved` : `Your claim on ${venue.name} wasn't approved`,
			link: `/venues/${claim.venue_id}`
		},
		email: { subject, html }
	});

	logger.info('venue claim reviewed', { claimId: params.id, action, adminId: user.id });

	return json({ ok: true });
};
