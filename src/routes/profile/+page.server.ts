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

	const { data: venueEvents } = await supabase
		.from('venue_events')
		.select('*')
		.eq('profile_id', user.id)
		.order('date', { ascending: true });

	return { user, profile, posts: postsData, likeCounts, venueEvents: venueEvents ?? [] };
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

		const profileTypeRaw = (data.get('profile_type') as string) || 'artist';
		const profileType = ['artist', 'venue'].includes(profileTypeRaw) ? profileTypeRaw : 'artist';

		const fullName = data.get('full_name') as string;
		const bio = data.get('bio') as string;
		const location = data.get('location') as string;
		const contactEmail = data.get('contact_email') as string;
		const instagram = data.get('instagram') as string;

		if (fullName && fullName.length > 100) return fail(400, { updateError: 'Name must be 100 characters or fewer' });
		if (bio && bio.length > 500) return fail(400, { updateError: 'Bio must be 500 characters or fewer' });
		if (location && location.length > 200) return fail(400, { updateError: 'Location must be 200 characters or fewer' });
		if (contactEmail && contactEmail.length > 254) return fail(400, { updateError: 'Email must be 254 characters or fewer' });
		if (instagram && instagram.length > 30) return fail(400, { updateError: 'Instagram handle must be 30 characters or fewer' });

		const lat = latRaw ? parseFloat(latRaw) : null;
		const lng = lngRaw ? parseFloat(lngRaw) : null;
		if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) return fail(400, { updateError: 'Invalid latitude' });
		if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) return fail(400, { updateError: 'Invalid longitude' });

		const { error } = await supabase.from('profiles').upsert({
			id: user.id,
			full_name: fullName,
			location: location,
			location_lat: lat,
			location_lng: lng,
			bio: bio,
			contact_email: contactEmail,
			instagram: instagram,
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

	createEvent: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');
		const data = await request.formData();
		const title = data.get('title') as string;
		const description = data.get('description') as string;
		if (!title?.trim()) return fail(400, { eventError: 'Title is required' });
		if (title.length > 200) return fail(400, { eventError: 'Title must be 200 characters or fewer' });
		if (description && description.length > 1000) return fail(400, { eventError: 'Description must be 1000 characters or fewer' });
		const { error } = await supabase.from('venue_events').insert({
			profile_id: user.id,
			title,
			date: data.get('date') as string,
			start_time: (data.get('start_time') as string) || null,
			end_time: (data.get('end_time') as string) || null,
			description: description || null
		});
		if (error) return fail(500, { eventError: error.message });
		return { eventCreated: true };
	},

	updateEvent: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');
		const data = await request.formData();
		const eventId = data.get('event_id') as string;
		const title = data.get('title') as string;
		const description = data.get('description') as string;
		if (!title?.trim()) return fail(400, { eventError: 'Title is required' });
		if (title.length > 200) return fail(400, { eventError: 'Title must be 200 characters or fewer' });
		if (description && description.length > 1000) return fail(400, { eventError: 'Description must be 1000 characters or fewer' });
		const { error } = await supabase.from('venue_events').update({
			title,
			date: data.get('date') as string,
			start_time: (data.get('start_time') as string) || null,
			end_time: (data.get('end_time') as string) || null,
			description: description || null
		}).eq('id', eventId).eq('profile_id', user.id);
		if (error) return fail(500, { eventError: error.message });
		return { eventUpdated: true };
	},

	deleteEvent: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');
		const data = await request.formData();
		const eventId = data.get('event_id') as string;
		const { error } = await supabase.from('venue_events').delete()
			.eq('id', eventId).eq('profile_id', user.id);
		if (error) return fail(500, { eventError: error.message });
		return { eventDeleted: true };
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
