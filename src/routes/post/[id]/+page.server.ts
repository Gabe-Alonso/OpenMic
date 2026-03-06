import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: post } = await supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url, location)')
		.eq('id', params.id)
		.single();

	if (!post) throw error(404, 'Post not found');

	return { post };
};
