import { error, fail } from '@sveltejs/kit';
import { logger } from '@sentry/sveltekit';
import type { Actions, PageServerLoad } from './$types';
import { domainsMatch } from '$lib/server/venueClaims';
import { notify } from '$lib/server/notify';
import { venueClaimDecidedEmail } from '$lib/server/email';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: venue } = await supabase
		.from('venues')
		.select('id, name, address, city, website, phone, claimed_profile_id')
		.eq('id', params.id)
		.single();

	if (!venue) throw error(404, 'Venue not found');

	let myClaim: { status: string } | null = null;
	if (user && !venue.claimed_profile_id) {
		const { data } = await supabase
			.from('venue_claims')
			.select('status')
			.eq('venue_id', venue.id)
			.eq('claimant_id', user.id)
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		myClaim = data;
	}

	return { venue, myClaim, signedIn: !!user };
};

export const actions: Actions = {
	default: async ({ params, request, url, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { claimError: 'Sign in to claim this venue.' });

		const data = await request.formData();
		const role = data.get('role') as string;
		const note = data.get('note') as string;
		if (!['owner', 'manager', 'representative'].includes(role)) {
			return fail(400, { claimError: 'Select your role.' });
		}
		if (note && note.length > 1000) return fail(400, { claimError: 'Note must be 1000 characters or fewer' });

		const { data: venue } = await supabase
			.from('venues')
			.select('id, name, website, claimed_profile_id')
			.eq('id', params.id)
			.single();
		if (!venue) return fail(404, { claimError: 'Venue not found' });
		if (venue.claimed_profile_id) return fail(400, { claimError: 'This venue has already been claimed.' });

		const { data: existingPending } = await supabase
			.from('venue_claims')
			.select('id')
			.eq('venue_id', venue.id)
			.eq('claimant_id', user.id)
			.eq('status', 'pending')
			.maybeSingle();
		if (existingPending) return fail(400, { claimError: 'You already have a pending claim on this venue.' });

		const approved = domainsMatch(user.email ?? '', venue.website);

		const { error: insertErr } = await supabase.from('venue_claims').insert({
			venue_id: venue.id,
			claimant_id: user.id,
			role,
			note: note?.trim() || null,
			status: approved ? 'approved' : 'pending',
			auto_approved: approved,
			reviewed_at: approved ? new Date().toISOString() : null
		});
		if (insertErr) return fail(500, { claimError: insertErr.message });

		if (approved) {
			// venues has no RLS policy letting a regular user write to it —
			// venue data is admin/service-role-only to write, the same as the
			// seed-venues route — so claiming needs the service-role client here,
			// not the claimant's own session-scoped one.
			const { error: updateErr } = await supabaseAdmin()
				.from('venues')
				.update({ claimed_profile_id: user.id })
				.eq('id', venue.id)
				.is('claimed_profile_id', null);
			if (updateErr) return fail(500, { claimError: updateErr.message });

			logger.info('venue claim auto-approved via domain match', { venueId: venue.id, claimantId: user.id });

			const { subject, html } = venueClaimDecidedEmail(venue.name, true, `${url.origin}/venues/${venue.id}`);
			await notify(user.id, 'venue_claim_decided', {
				inApp: { title: `Your claim on ${venue.name} was approved`, link: `/venues/${venue.id}` },
				email: { subject, html }
			});
		} else {
			logger.info('venue claim submitted for manual review', { venueId: venue.id, claimantId: user.id });
		}

		return { claimSubmitted: true, approved };
	}
};
