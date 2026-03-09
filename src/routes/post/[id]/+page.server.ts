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

	const { data: post } = await supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url, location)')
		.eq('id', params.id)
		.single();

	if (!post) throw error(404, 'Post not found');

	const authorId = (post.profiles as any)?.id as string | undefined;

	const [{ count: likeCount }, likerRes, likedRes, followersRes, followingRes, { count: commentCount }] = await Promise.all([
		supabase
			.from('post_likes')
			.select('*', { count: 'exact', head: true })
			.eq('post_id', params.id),
		supabase
			.from('post_likes')
			.select('user_id, profiles(id, full_name, avatar_url)')
			.eq('post_id', params.id)
			.order('created_at', { ascending: false })
			.limit(50),
		user
			? supabase
					.from('post_likes')
					.select('id')
					.eq('post_id', params.id)
					.eq('user_id', user.id)
					.maybeSingle()
			: Promise.resolve({ data: null }),
		authorId
			? supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', authorId)
			: Promise.resolve({ count: 0 }),
		authorId
			? supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', authorId)
			: Promise.resolve({ count: 0 }),
		supabase
			.from('post_comments')
			.select('*', { count: 'exact', head: true })
			.eq('post_id', params.id)
	]);

	const mutuals =
		user && authorId && user.id !== authorId
			? await getMutuals(supabase, user.id, authorId)
			: [];

	return {
		post,
		likeCount: likeCount ?? 0,
		userLiked: !!likedRes.data,
		likers: likerRes.data ?? [],
		authorFollowerCount: followersRes.count ?? 0,
		authorFollowingCount: followingRes.count ?? 0,
		mutuals,
		commentCount: commentCount ?? 0,
		currentUserId: user?.id ?? null
	};
};
