import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { data: notifications } = await supabase
		.from('notifications')
		.select('id, type, title, body, link, read_at, created_at')
		.eq('recipient_id', user.id)
		.order('created_at', { ascending: false })
		.limit(30);

	const { count: unreadCount } = await supabase
		.from('notifications')
		.select('*', { count: 'exact', head: true })
		.eq('recipient_id', user.id)
		.is('read_at', null);

	return json({ notifications: notifications ?? [], unreadCount: unreadCount ?? 0 });
};

// Marks every notification for the signed-in user as read.
export const PATCH: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { error } = await supabase
		.from('notifications')
		.update({ read_at: new Date().toISOString() })
		.eq('recipient_id', user.id)
		.is('read_at', null);

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ ok: true });
};
