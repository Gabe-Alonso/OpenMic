import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { boundingBoxForRadius, applyBoundingBox, withinRadius } from '$lib/server/geo';
import { decodeCursor, applyCursor, paginateRows } from '$lib/server/pagination';
import { embedEngagement } from '$lib/server/feed';

const PAGE_SIZE = 20;

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { data: userProfile } = await supabase
		.from('profiles')
		.select('location_lat, location_lng')
		.eq('id', user.id)
		.single();

	if (!userProfile?.location_lat || !userProfile?.location_lng) {
		return json({ noLocation: true, posts: [], nextCursor: null });
	}

	const radius = parseInt(url.searchParams.get('radius') ?? '50');
	const cursor = decodeCursor(url.searchParams.get('cursor'));

	// Indexed bounding-box prefilter instead of pulling every located profile
	// in the system and running a distance check on each one in JS.
	const box = boundingBoxForRadius(userProfile.location_lat, userProfile.location_lng, radius);
	let candidateQuery = supabase.from('profiles').select('id, location_lat, location_lng');
	candidateQuery = applyBoundingBox(candidateQuery, box);
	const { data: candidates } = await candidateQuery;

	const nearbyIds = withinRadius(candidates ?? [], userProfile.location_lat, userProfile.location_lng, radius)
		.filter((p) => p.id !== user.id)
		.map((p) => p.id);

	if (nearbyIds.length === 0) {
		return json({ noLocation: false, posts: [], nextCursor: null });
	}

	let postsQuery = supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url)')
		.in('author_id', nearbyIds)
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(PAGE_SIZE + 1);
	postsQuery = applyCursor(postsQuery, cursor);

	const { data: posts } = await postsQuery;
	const { page: postsData, nextCursor } = paginateRows(posts ?? [], PAGE_SIZE);
	const embedded = await embedEngagement(supabase, postsData, user.id);

	return json({ noLocation: false, posts: embedded, nextCursor });
};
