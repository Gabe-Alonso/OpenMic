import { error, json } from '@sveltejs/kit';
import { logger } from '@sentry/sveltekit';
import type { RequestHandler } from './$types';
import { PRIVATE_ADMIN_EMAIL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

export const PATCH: RequestHandler = async ({ params, request, locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');
	if (user.email !== PRIVATE_ADMIN_EMAIL) throw error(403, 'Forbidden');

	const { action } = await request.json();
	if (!['dismiss', 'remove_post'].includes(action)) throw error(400, 'Invalid action');

	const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const { data: report } = await admin.from('reports').select('post_id').eq('id', params.id).maybeSingle();
	if (!report) throw error(404, 'Report not found');

	if (action === 'remove_post') {
		// Cascades: deleting the post removes this report, and every other
		// pending report against the same post, in one step.
		const { error: deleteErr } = await admin.from('posts').delete().eq('id', report.post_id);
		if (deleteErr) throw error(500, deleteErr.message);
	} else {
		const { error: updateErr } = await admin
			.from('reports')
			.update({ status: 'dismissed', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
			.eq('id', params.id);
		if (updateErr) throw error(500, updateErr.message);
	}

	logger.info('report reviewed', { reportId: params.id, action, adminId: user.id });

	return json({ ok: true });
};
