import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw error(401, 'Unauthorized');

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const conversationId = formData.get('conversation_id') as string | null;

	if (!file || !conversationId) throw error(400, 'Missing file or conversation_id');
	if (file.size > 5 * 1024 * 1024) throw error(400, 'File too large (max 5MB)');

	const ext = file.name.split('.').pop() ?? 'jpg';
	const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
	const arrayBuffer = await file.arrayBuffer();

	const { error: uploadErr } = await supabase.storage
		.from('message-images')
		.upload(path, arrayBuffer, { contentType: file.type });

	if (uploadErr) throw error(500, uploadErr.message);

	const { data } = supabase.storage.from('message-images').getPublicUrl(path);

	return json({ url: data.publicUrl });
};
