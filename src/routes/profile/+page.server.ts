import { fail, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { user } = await safeGetSession();
	if (!user) throw redirect(303, '/signin');

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	const { data: posts } = await supabase
		.from('posts')
		.select('*, post_media(*)')
		.eq('author_id', user.id)
		.order('created_at', { ascending: false });

	const postsData = posts ?? [];
	const likeCounts: Record<string, number> = {};
	if (postsData.length > 0) {
		const { data: likes } = await supabase
			.from('post_likes')
			.select('post_id')
			.in('post_id', postsData.map((p) => p.id));
		for (const like of likes ?? []) {
			likeCounts[like.post_id] = (likeCounts[like.post_id] ?? 0) + 1;
		}
	}

	return { user, profile, posts: postsData, likeCounts };
};

export const actions: Actions = {
	updateProfile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const data = await request.formData();

		const latRaw = data.get('location_lat') as string;
		const lngRaw = data.get('location_lng') as string;
		const tagsRaw = data.get('tags') as string;
		const artistRolesRaw = data.get('artist_roles') as string;
		let tags: string[] = [];
		try { tags = tagsRaw ? JSON.parse(tagsRaw) : []; } catch { tags = []; }
		let artistRoles: string[] = [];
		try { artistRoles = artistRolesRaw ? JSON.parse(artistRolesRaw) : []; } catch { artistRoles = []; }

		const profileType = (data.get('profile_type') as string) || 'artist';

		const { error } = await supabase.from('profiles').upsert({
			id: user.id,
			full_name: data.get('full_name') as string,
			location: data.get('location') as string,
			location_lat: latRaw ? parseFloat(latRaw) : null,
			location_lng: lngRaw ? parseFloat(lngRaw) : null,
			bio: data.get('bio') as string,
			contact_email: data.get('contact_email') as string,
			instagram: data.get('instagram') as string,
			tags,
			profile_type: profileType,
			artist_roles: profileType === 'artist' ? artistRoles : [],
			updated_at: new Date().toISOString()
		});

		if (error) return fail(500, { updateError: error.message });
		return { updated: true };
	},

	toggleDiscoverable: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const data = await request.formData();
		// Checkbox is present in form data when checked, absent when unchecked
		const discoverable = data.has('discoverable');

		const { error } = await supabase
			.from('profiles')
			.update({ discoverable, updated_at: new Date().toISOString() })
			.eq('id', user.id);

		if (error) return fail(500, { toggleError: error.message });
		return {};
	},

	deleteAccount: async ({ locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		// Admin client required to delete auth users — key stays server-side only
		const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: { autoRefreshToken: false, persistSession: false }
		});

		await supabase.auth.signOut();
		const { error } = await adminClient.auth.admin.deleteUser(user.id);

		if (error) return fail(500, { deleteError: error.message });
		throw redirect(303, '/');
	}
};
