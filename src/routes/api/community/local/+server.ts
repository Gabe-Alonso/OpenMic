import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 3958.8;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { data: userProfile } = await supabase
		.from('profiles')
		.select('location_lat, location_lng')
		.eq('id', user.id)
		.single();

	if (!userProfile?.location_lat || !userProfile?.location_lng) {
		return json({ noLocation: true, posts: [], likeCounts: {} });
	}

	const radius = parseInt(url.searchParams.get('radius') ?? '50');

	const { data: profiles } = await supabase
		.from('profiles')
		.select('id, location_lat, location_lng')
		.not('location_lat', 'is', null)
		.not('location_lng', 'is', null);

	const nearbyIds = (profiles ?? [])
		.filter(
			(p) =>
				p.id !== user.id &&
				distanceMiles(
					userProfile.location_lat!,
					userProfile.location_lng!,
					p.location_lat!,
					p.location_lng!
				) <= radius
		)
		.map((p) => p.id);

	if (nearbyIds.length === 0) {
		return json({ noLocation: false, posts: [], likeCounts: {} });
	}

	const { data: posts } = await supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url)')
		.in('author_id', nearbyIds)
		.order('created_at', { ascending: false })
		.limit(100);

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

	return json({ noLocation: false, posts: postsData, likeCounts });
};
