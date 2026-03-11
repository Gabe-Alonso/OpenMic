import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type MutualProfile = { id: string; full_name: string | null; avatar_url: string | null };

async function getMutuals(
	supabase: any,
	currentUserId: string,
	targetId: string
): Promise<MutualProfile[]> {
	const { data: userFollowings } = await supabase
		.from('follows')
		.select('following_id')
		.eq('follower_id', currentUserId);

	const followingIds = (userFollowings ?? [])
		.map((f: any) => f.following_id)
		.filter((id: string) => id !== targetId);

	if (followingIds.length === 0) return [];

	const [{ data: mutualFollowers }, { data: mutualFollowings }] = await Promise.all([
		supabase
			.from('follows')
			.select('follower_id')
			.eq('following_id', targetId)
			.in('follower_id', followingIds),
		supabase
			.from('follows')
			.select('following_id')
			.eq('follower_id', targetId)
			.in('following_id', followingIds)
	]);

	const mutualIds = new Set([
		...(mutualFollowers ?? []).map((f: any) => f.follower_id),
		...(mutualFollowings ?? []).map((f: any) => f.following_id)
	]);

	if (mutualIds.size === 0) return [];

	const { data: profiles } = await supabase
		.from('profiles')
		.select('id, full_name, avatar_url')
		.in('id', [...mutualIds])
		.limit(50);

	return profiles ?? [];
}

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!profile) throw error(404, 'Profile not found');

	const { data: posts } = await supabase
		.from('posts')
		.select('*, post_media(*)')
		.eq('author_id', params.id)
		.order('created_at', { ascending: false });

	const postsData = posts ?? [];
	const likeCounts: Record<string, number> = {};
	if (postsData.length > 0) {
		const { data: likes } = await supabase
			.from('post_likes')
			.select('post_id')
			.in('post_id', postsData.map((p: any) => p.id));
		for (const like of likes ?? []) {
			likeCounts[like.post_id] = (likeCounts[like.post_id] ?? 0) + 1;
		}
	}

	const isOwnProfile = user?.id === params.id;

	const [followersRes, followingRes, userFollowsRes] = await Promise.all([
		supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', params.id),
		supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', params.id),
		user && !isOwnProfile
			? supabase
					.from('follows')
					.select('id')
					.eq('follower_id', user.id)
					.eq('following_id', params.id)
					.maybeSingle()
			: Promise.resolve({ data: null })
	]);

	const mutuals =
		user && !isOwnProfile ? await getMutuals(supabase, user.id, params.id) : [];

	const { data: venueEventsRaw } = await supabase
		.from('venue_events').select('*').eq('profile_id', params.id).order('date', { ascending: true });

	return {
		profile,
		posts: postsData,
		likeCounts,
		followerCount: followersRes.count ?? 0,
		followingCount: followingRes.count ?? 0,
		userFollows: !!userFollowsRes.data,
		isOwnProfile,
		mutuals,
		venueEvents: venueEventsRaw ?? []
	};
};
