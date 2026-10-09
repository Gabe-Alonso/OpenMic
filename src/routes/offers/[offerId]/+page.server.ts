import { error, fail, redirect } from '@sveltejs/kit';
import { notify } from '$lib/server/notify';
import { slotOfferDecidedEmail } from '$lib/server/email';
import type { Actions, PageServerLoad } from './$types';

type OfferRow = {
	id: string;
	message: string | null;
	status: 'pending' | 'accepted' | 'declined' | 'cancelled';
	artist_profile_id: string;
	created_at: string;
	slot: {
		id: string;
		start_time: string | null;
		end_time: string | null;
		status: 'open' | 'reserved' | 'filled';
		event: {
			id: string;
			title: string;
			date: string;
			profile_id: string;
			venue: { id: string; full_name: string | null; avatar_url: string | null } | null;
		} | null;
	} | null;
};

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw redirect(303, '/signin');

	const { data: offer } = await supabase
		.from('slot_offers')
		.select(
			`id, message, status, artist_profile_id, created_at,
			 slot:event_slots(id, start_time, end_time, status,
				event:venue_events(id, title, date, profile_id, venue:profiles!profile_id(id, full_name, avatar_url)))`
		)
		.eq('id', params.offerId)
		.maybeSingle<OfferRow>();

	if (!offer) throw error(404, 'Invitation not found');
	if (offer.artist_profile_id !== user.id) throw error(403, "This invitation isn't addressed to you");

	return { offer };
};

export const actions: Actions = {
	accept: async ({ params, url, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const { data: offer } = await supabase
			.from('slot_offers')
			.select('slot:event_slots(event:venue_events(id, title, profile_id))')
			.eq('id', params.offerId)
			.maybeSingle<{ slot: { event: { id: string; title: string; profile_id: string } | null } | null }>();

		const { error: rpcError } = await supabase.rpc('accept_slot_offer', { p_offer_id: params.offerId });
		if (rpcError) return fail(400, { offerError: rpcError.message });

		const event = offer?.slot?.event;
		if (event) {
			const { data: artistProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
			const manageUrl = `${url.origin}/profile/events/${event.id}`;
			const { subject, html } = slotOfferDecidedEmail(artistProfile?.full_name ?? 'The artist', event.title, true, manageUrl);
			await notify(event.profile_id, 'slot_offer_decided', {
				inApp: { title: `${artistProfile?.full_name ?? 'The artist'} accepted your invitation for ${event.title}`, link: manageUrl },
				email: { subject, html }
			});
		}

		return { decided: true, accepted: true };
	},

	decline: async ({ params, url, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const { data: offer } = await supabase
			.from('slot_offers')
			.select('slot:event_slots(event:venue_events(id, title, profile_id))')
			.eq('id', params.offerId)
			.maybeSingle<{ slot: { event: { id: string; title: string; profile_id: string } | null } | null }>();

		const { error: rpcError } = await supabase.rpc('decline_slot_offer', { p_offer_id: params.offerId });
		if (rpcError) return fail(400, { offerError: rpcError.message });

		const event = offer?.slot?.event;
		if (event) {
			const { data: artistProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
			const manageUrl = `${url.origin}/profile/events/${event.id}`;
			const { subject, html } = slotOfferDecidedEmail(artistProfile?.full_name ?? 'The artist', event.title, false, manageUrl);
			await notify(event.profile_id, 'slot_offer_decided', {
				inApp: { title: `${artistProfile?.full_name ?? 'The artist'} declined your invitation for ${event.title}`, link: manageUrl },
				email: { subject, html }
			});
		}

		return { decided: true, accepted: false };
	}
};
