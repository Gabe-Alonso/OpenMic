import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { decodeCursor, applyCursor, paginateRows } from '$lib/server/pagination';
import { checkRateLimit, rateLimitResponse } from '$lib/server/rateLimit';

const PAGE_SIZE = 10;

function targetColumn(url: URL): { column: 'venue_profile_id' | 'seeded_venue_id'; id: string } | null {
	const venueProfileId = url.searchParams.get('venue_profile_id');
	const seededVenueId = url.searchParams.get('seeded_venue_id');
	if (venueProfileId) return { column: 'venue_profile_id', id: venueProfileId };
	if (seededVenueId) return { column: 'seeded_venue_id', id: seededVenueId };
	return null;
}

function isValidRating(n: unknown): n is number {
	return typeof n === 'number' && n >= 0 && n <= 5 && Number.isInteger(n * 2);
}

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const target = targetColumn(url);
	if (!target) return json({ error: 'venue_profile_id or seeded_venue_id required' }, { status: 400 });

	const { user } = await safeGetSession();
	const limit = Math.min(Number(url.searchParams.get('limit')) || PAGE_SIZE, 50);
	const cursor = decodeCursor(url.searchParams.get('cursor'));

	const [{ data: allRatings }, reviewsQuery] = await Promise.all([
		supabase.from('venue_ratings').select('rating').eq(target.column, target.id),
		(() => {
			let q = supabase
				.from('venue_ratings')
				.select('id, rating, comment, created_at, updated_at, reviewer:profiles!reviewer_id(id, full_name, avatar_url)')
				.eq(target.column, target.id)
				.order('created_at', { ascending: false })
				.order('id', { ascending: false })
				.limit(limit + 1);
			q = applyCursor(q, cursor);
			return q;
		})()
	]);

	const { data: reviews } = await reviewsQuery;
	const { page, nextCursor } = paginateRows((reviews ?? []) as any[], limit);

	const ratings = allRatings ?? [];
	const average = ratings.length > 0 ? ratings.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / ratings.length : null;

	let myReview: any = null;
	if (user) {
		const { data } = await supabase
			.from('venue_ratings')
			.select('id, rating, comment')
			.eq(target.column, target.id)
			.eq('reviewer_id', user.id)
			.maybeSingle();
		myReview = data;
	}

	return json({
		average,
		count: ratings.length,
		reviews: page,
		nextCursor,
		myReview
	});
};

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	if (!(await checkRateLimit(supabase, `venue-rating:create:${user.id}`, { windowSeconds: 3600, max: 30 }))) {
		return rateLimitResponse();
	}

	const body = await request.json();
	const { venue_profile_id, seeded_venue_id, rating, comment } = body;

	if (!venue_profile_id && !seeded_venue_id) {
		return json({ error: 'venue_profile_id or seeded_venue_id required' }, { status: 400 });
	}
	if (venue_profile_id && seeded_venue_id) {
		return json({ error: 'Provide only one of venue_profile_id or seeded_venue_id' }, { status: 400 });
	}
	if (!isValidRating(rating)) {
		return json({ error: 'Rating must be between 0 and 5, in 0.5 steps' }, { status: 400 });
	}
	if (venue_profile_id === user.id) {
		return json({ error: 'You cannot rate your own venue' }, { status: 400 });
	}
	const trimmedComment = typeof comment === 'string' ? comment.trim().slice(0, 2000) : null;

	const { data, error } = await supabase
		.from('venue_ratings')
		.upsert(
			{
				reviewer_id: user.id,
				venue_profile_id: venue_profile_id ?? null,
				seeded_venue_id: seeded_venue_id ?? null,
				rating,
				comment: trimmedComment || null,
				updated_at: new Date().toISOString()
			},
			{ onConflict: venue_profile_id ? 'reviewer_id,venue_profile_id' : 'reviewer_id,seeded_venue_id' }
		)
		.select('id, rating, comment, created_at, updated_at')
		.single();

	if (error) return json({ error: error.message }, { status: 500 });

	return json(data);
};
