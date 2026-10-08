import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bandJoinRequestEmail, bandJoinAcceptedEmail } from '$lib/server/email';
import { notify } from '$lib/server/notify';

export const POST: RequestHandler = async ({ params, url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (user.id === params.id) return json({ error: 'A band cannot join itself' }, { status: 400 });

	const { data: band } = await supabase
		.from('profiles')
		.select('is_band')
		.eq('id', params.id)
		.maybeSingle();
	if (!band?.is_band) return json({ error: 'Not a band account' }, { status: 400 });

	const { error } = await supabase
		.from('band_memberships')
		.insert({ band_id: params.id, member_id: user.id, status: 'pending' });
	if (error) return json({ error: error.message }, { status: 403 });

	const { data: requesterProfile } = await supabase
		.from('profiles')
		.select('full_name')
		.eq('id', user.id)
		.maybeSingle();
	const requesterName = requesterProfile?.full_name ?? 'Someone';
	const { subject, html } = bandJoinRequestEmail(requesterName, `${url.origin}/profile/${params.id}`);
	await notify(params.id, 'band_join_request', {
		inApp: { title: `${requesterName} wants to join your band`, link: `/profile/${params.id}` },
		email: { subject, html }
	});

	return json({ status: 'pending' });
};

export const PATCH: RequestHandler = async ({ params, request, url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (user.id !== params.id) return json({ error: 'Only the band account can accept members' }, { status: 403 });

	const { member_id } = await request.json();
	if (typeof member_id !== 'string') return json({ error: 'member_id required' }, { status: 400 });

	const { error } = await supabase
		.from('band_memberships')
		.update({ status: 'accepted' })
		.eq('band_id', params.id)
		.eq('member_id', member_id);
	if (error) return json({ error: error.message }, { status: 403 });

	const { data: bandProfile } = await supabase
		.from('profiles')
		.select('full_name')
		.eq('id', params.id)
		.maybeSingle();
	const bandName = bandProfile?.full_name ?? 'The band';
	const { subject, html } = bandJoinAcceptedEmail(bandName, `${url.origin}/profile/${params.id}`);
	await notify(member_id, 'band_join_accepted', {
		inApp: { title: `${bandName} accepted your request to join`, link: `/profile/${params.id}` },
		email: { subject, html }
	});

	return json({ status: 'accepted' });
};

export const DELETE: RequestHandler = async ({ params, url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const memberId = url.searchParams.get('member_id') ?? user.id;

	const { error } = await supabase
		.from('band_memberships')
		.delete()
		.eq('band_id', params.id)
		.eq('member_id', memberId);
	if (error) return json({ error: error.message }, { status: 403 });

	return json({ removed: true });
};
