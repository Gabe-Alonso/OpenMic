import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
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

	return json({ status: 'pending' });
};

export const PATCH: RequestHandler = async ({ params, request, locals: { supabase, safeGetSession } }) => {
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
