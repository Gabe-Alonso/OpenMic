import { fail, redirect } from '@sveltejs/kit';
import { logger } from '@sentry/sveltekit';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { notifyNearbyUsersOfEvent } from '$lib/server/notify';
import type { Actions, PageServerLoad } from './$types';

function parseEventPayAndGenres(data: FormData): { payMin: number | null; payMax: number | null; genres: string[] } {
	const payMinRaw = data.get('pay_min') as string;
	const payMaxRaw = data.get('pay_max') as string;
	const payMin = payMinRaw ? Number(payMinRaw) : null;
	const payMax = payMaxRaw ? Number(payMaxRaw) : null;
	const genresRaw = data.get('genres') as string;
	let genres: string[] = [];
	try {
		genres = genresRaw ? JSON.parse(genresRaw) : [];
	} catch {
		genres = [];
	}
	return {
		payMin: payMin != null && Number.isFinite(payMin) ? payMin : null,
		payMax: payMax != null && Number.isFinite(payMax) ? payMax : null,
		genres: Array.isArray(genres) ? genres.filter((g): g is string => typeof g === 'string').slice(0, 10) : []
	};
}

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
			is_band: data.has('is_band'),
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

	// One row's form submits here at a time (just its own type's two
	// checkboxes), not all five — so this only ever touches that one type,
	// merged into whatever's already stored. nearby_event's `filters` object
	// in particular must survive a plain email/in_app toggle untouched.
	updateNotificationPreference: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const data = await request.formData();
		const type = data.get('type') as string;
		const validTypes = ['new_follower', 'new_comment', 'band_join_request', 'band_join_accepted', 'nearby_event'];
		if (!validTypes.includes(type)) return fail(400, { toggleError: 'Invalid notification type' });

		const { data: profile } = await supabase.from('profiles').select('notification_preferences').eq('id', user.id).maybeSingle();
		const existing = (profile?.notification_preferences as Record<string, any>) ?? {};

		const preferences = {
			...existing,
			[type]: { ...existing[type], email: data.has('email'), in_app: data.has('in_app') }
		};

		const { error } = await supabase
			.from('profiles')
			.update({ notification_preferences: preferences, updated_at: new Date().toISOString() })
			.eq('id', user.id);

		if (error) return fail(500, { toggleError: error.message });
		return {};
	},

	updateNearbyEventFilters: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');

		const data = await request.formData();
		const maxMiles = Number(data.get('max_miles')) || 50;
		const minPay = Number(data.get('min_pay')) || 0;
		let genreValues: string[] = [];
		try {
			genreValues = JSON.parse((data.get('genre_values') as string) ?? '[]');
		} catch {
			genreValues = [];
		}

		const { data: profile } = await supabase.from('profiles').select('notification_preferences').eq('id', user.id).maybeSingle();
		const existing = (profile?.notification_preferences as Record<string, any>) ?? {};
		const existingNearby = existing.nearby_event ?? { email: true, in_app: true };

		const preferences = {
			...existing,
			nearby_event: {
				...existingNearby,
				filters: {
					distance: { enabled: data.has('distance_enabled'), max_miles: maxMiles },
					pay: { enabled: data.has('pay_enabled'), min_pay: minPay },
					genres: {
						enabled: data.has('genres_enabled'),
						values: Array.isArray(genreValues) ? genreValues.filter((g): g is string => typeof g === 'string').slice(0, 10) : []
					}
				}
			}
		};

		const { error } = await supabase
			.from('profiles')
			.update({ notification_preferences: preferences, updated_at: new Date().toISOString() })
			.eq('id', user.id);

		if (error) return fail(500, { toggleError: error.message });
		return { filtersSaved: true };
	},

	createEvent: async ({ request, url, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) throw redirect(303, '/signin');
		const data = await request.formData();
		const title = data.get('title') as string;
		const description = data.get('description') as string;
		const date = data.get('date') as string;
		if (!title?.trim()) return fail(400, { eventError: 'Title is required' });
		if (title.length > 200) return fail(400, { eventError: 'Title must be 200 characters or fewer' });
		if (description && description.length > 1000) return fail(400, { eventError: 'Description must be 1000 characters or fewer' });

		const { payMin, payMax, genres } = parseEventPayAndGenres(data);

		const { error } = await supabase.from('venue_events').insert({
			profile_id: user.id,
			title,
			date,
			start_time: (data.get('start_time') as string) || null,
			end_time: (data.get('end_time') as string) || null,
			description: description || null,
			pay_min: payMin,
			pay_max: payMax,
			genres
		});
		if (error) return fail(500, { eventError: error.message });

		const { data: hostProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
		await notifyNearbyUsersOfEvent(user.id, hostProfile?.full_name ?? 'Someone nearby', title, date, url.origin, payMin, payMax, genres);

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

		const { payMin, payMax, genres } = parseEventPayAndGenres(data);

		const { error } = await supabase.from('venue_events').update({
			title,
			date: data.get('date') as string,
			start_time: (data.get('start_time') as string) || null,
			end_time: (data.get('end_time') as string) || null,
			description: description || null,
			pay_min: payMin,
			pay_max: payMax,
			genres
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

		logger.warn('account deleted', { userId: user.id });

		throw redirect(303, '/');
	}
};
