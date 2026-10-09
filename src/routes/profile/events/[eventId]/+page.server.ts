import { error, fail, redirect } from '@sveltejs/kit';
import { notify } from '$lib/server/notify';
import {
	slotApplicationDecidedEmail,
	slotOfferEmail
} from '$lib/server/email';
import type { Actions, PageServerLoad } from './$types';

type SlotProfile = { id: string; full_name: string | null; avatar_url: string | null };

export const load: PageServerLoad = async ({ params, url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw redirect(303, '/signin');

	const { data: event } = await supabase
		.from('venue_events')
		.select('*')
		.eq('id', params.eventId)
		.eq('profile_id', user.id)
		.maybeSingle();
	if (!event) throw error(404, 'Event not found');

	const { data: slots, error: slotsError } = await supabase
		.from('event_slots')
		.select(
			`id, start_time, end_time, status, filled_at,
			 artist:profiles!artist_profile_id(id, full_name, avatar_url),
			 applications:slot_applications(id, message, status, created_at, artist:profiles!artist_profile_id(id, full_name, avatar_url)),
			 offers:slot_offers(id, message, status, created_at, artist:profiles!artist_profile_id(id, full_name, avatar_url))`
		)
		.eq('event_id', params.eventId)
		.order('created_at', { ascending: true });
	if (slotsError) throw error(500, slotsError.message);

	return { event, slots: slots ?? [], origin: url.origin };
};

async function loadEventAndVerifyOwner(supabase: any, eventId: string, userId: string) {
	const { data: event } = await supabase
		.from('venue_events')
		.select('id, title, profile_id')
		.eq('id', eventId)
		.eq('profile_id', userId)
		.maybeSingle();
	return event as { id: string; title: string; profile_id: string } | null;
}

export const actions: Actions = {
	addSlot: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const event = await loadEventAndVerifyOwner(supabase, params.eventId, user.id);
		if (!event) return fail(404, { slotError: 'Event not found' });

		const data = await request.formData();
		const startTime = (data.get('start_time') as string) || null;
		const endTime = (data.get('end_time') as string) || null;

		const { error: insertErr } = await supabase.from('event_slots').insert({
			event_id: event.id,
			start_time: startTime,
			end_time: endTime
		});
		if (insertErr) return fail(500, { slotError: insertErr.message });
		return { slotAdded: true };
	},

	deleteSlot: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const data = await request.formData();
		const slotId = data.get('slot_id') as string;
		// RLS (owner-only via the parent event's profile_id) is what actually
		// enforces this — the eq below just narrows the row, not the security.
		const { error: deleteErr } = await supabase.from('event_slots').delete().eq('id', slotId);
		if (deleteErr) return fail(500, { slotError: deleteErr.message });
		return { slotDeleted: true };
	},

	acceptApplication: async ({ params, url, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const event = await loadEventAndVerifyOwner(supabase, params.eventId, user.id);
		if (!event) return fail(404, { slotError: 'Event not found' });

		const data = await request.formData();
		const applicationId = data.get('application_id') as string;

		const { data: application } = await supabase
			.from('slot_applications')
			.select('id, slot_id, artist_profile_id')
			.eq('id', applicationId)
			.maybeSingle();
		if (!application) return fail(404, { slotError: 'Application not found' });

		const { data: siblings } = await supabase
			.from('slot_applications')
			.select('id, artist_profile_id')
			.eq('slot_id', application.slot_id)
			.eq('status', 'pending')
			.neq('id', applicationId);

		const { error: rpcError } = await supabase.rpc('accept_slot_application', {
			p_application_id: applicationId
		});
		if (rpcError) return fail(400, { slotError: rpcError.message });

		const eventUrl = `${url.origin}/profile/${event.profile_id}`;
		const acceptedEmail = slotApplicationDecidedEmail(event.title, true, eventUrl);
		await notify(application.artist_profile_id, 'slot_application_decided', {
			inApp: { title: `You're booked for ${event.title}`, link: eventUrl },
			email: acceptedEmail
		});

		const rejectedEmail = slotApplicationDecidedEmail(event.title, false, eventUrl);
		await Promise.all(
			(siblings ?? []).map((s: { id: string; artist_profile_id: string }) =>
				notify(s.artist_profile_id, 'slot_application_decided', {
					inApp: { title: `Update on your application for ${event.title}`, link: eventUrl },
					email: rejectedEmail
				})
			)
		);

		return { applicationAccepted: true };
	},

	rejectApplication: async ({ params, url, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const event = await loadEventAndVerifyOwner(supabase, params.eventId, user.id);
		if (!event) return fail(404, { slotError: 'Event not found' });

		const data = await request.formData();
		const applicationId = data.get('application_id') as string;

		const { data: application } = await supabase
			.from('slot_applications')
			.select('artist_profile_id')
			.eq('id', applicationId)
			.maybeSingle();

		const { error: updateErr } = await supabase
			.from('slot_applications')
			.update({ status: 'rejected', decided_at: new Date().toISOString() })
			.eq('id', applicationId);
		if (updateErr) return fail(500, { slotError: updateErr.message });

		if (application) {
			const eventUrl = `${url.origin}/profile/${event.profile_id}`;
			const { subject, html } = slotApplicationDecidedEmail(event.title, false, eventUrl);
			await notify(application.artist_profile_id, 'slot_application_decided', {
				inApp: { title: `Update on your application for ${event.title}`, link: eventUrl },
				email: { subject, html }
			});
		}

		return { applicationRejected: true };
	},

	sendOffer: async ({ params, url, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const event = await loadEventAndVerifyOwner(supabase, params.eventId, user.id);
		if (!event) return fail(404, { slotError: 'Event not found' });

		const data = await request.formData();
		const slotId = data.get('slot_id') as string;
		const artistId = data.get('artist_id') as string;
		const message = (data.get('message') as string) || null;
		if (message && message.length > 1000) return fail(400, { slotError: 'Message must be 1000 characters or fewer' });

		const { data: offerId, error: rpcError } = await supabase.rpc('create_slot_offer', {
			p_slot_id: slotId,
			p_artist_id: artistId,
			p_message: message
		});
		if (rpcError) return fail(400, { slotError: rpcError.message });

		const { data: hostProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
		const offerUrl = `${url.origin}/offers/${offerId}`;
		const { subject, html } = slotOfferEmail(hostProfile?.full_name ?? 'A venue', event.title, offerUrl);
		await notify(artistId, 'slot_offer', {
			inApp: { title: `${hostProfile?.full_name ?? 'A venue'} invited you to perform at ${event.title}`, link: offerUrl },
			email: { subject, html }
		});

		return { offerSent: true };
	},

	cancelOffer: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const event = await loadEventAndVerifyOwner(supabase, params.eventId, user.id);
		if (!event) return fail(404, { slotError: 'Event not found' });

		const data = await request.formData();
		const offerId = data.get('offer_id') as string;

		const { error: rpcError } = await supabase.rpc('cancel_slot_offer', { p_offer_id: offerId });
		if (rpcError) return fail(400, { slotError: rpcError.message });

		return { offerCancelled: true };
	}
};
