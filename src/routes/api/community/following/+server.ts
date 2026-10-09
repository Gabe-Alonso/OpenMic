import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyCursor } from '$lib/server/pagination';
import { embedEngagement, mergeFeedStreams, type FeedCandidate, type FeedCursor } from '$lib/server/feed';

const PAGE_SIZE = 20;

// A single `cursor` query param carries both sub-streams' positions —
// authored posts and reposts-by-someone-I-follow paginate independently
// (different tables, different timestamps) and get merged into one
// chronological page. See $lib/server/feed.ts for why neither sub-cursor can
// simply be "the last row fetched this round."
function encodeFollowingCursor(c: { p: FeedCursor | null; r: FeedCursor | null }): string {
	return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function decodeFollowingCursor(raw: string | null): { p: FeedCursor | null; r: FeedCursor | null } {
	if (!raw) return { p: null, r: null };
	try {
		const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
		return { p: parsed?.p ?? null, r: parsed?.r ?? null };
	} catch {
		return { p: null, r: null };
	}
}

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const includeFollowers = url.searchParams.get('include_followers') === 'true';
	const { p: postCursor, r: repostCursor } = decodeFollowingCursor(url.searchParams.get('cursor'));

	const { data: followingRows } = await supabase
		.from('follows')
		.select('following_id')
		.eq('follower_id', user.id);

	const targetIds = new Set((followingRows ?? []).map((r) => r.following_id));

	if (includeFollowers) {
		const { data: followerRows } = await supabase
			.from('follows')
			.select('follower_id')
			.eq('following_id', user.id);
		for (const r of followerRows ?? []) targetIds.add(r.follower_id);
	}

	if (targetIds.size === 0) {
		return json({ posts: [], nextCursor: null });
	}

	const targetIdList = [...targetIds];

	let postsQuery = supabase
		.from('posts')
		.select('*, post_media(*), profiles(id, full_name, avatar_url)')
		.in('author_id', targetIdList)
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(PAGE_SIZE + 1);
	postsQuery = applyCursor(postsQuery, postCursor);

	// Someone I follow reposting a post (by anyone, followed or not) also
	// belongs in my following feed — that's the whole point of a repost.
	let repostsQuery = supabase
		.from('post_reposts')
		.select(
			`id, created_at,
			 reposter:profiles!user_id(id, full_name, avatar_url),
			 post:posts(*, post_media(*), profiles(id, full_name, avatar_url))`
		)
		.in('user_id', targetIdList)
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(PAGE_SIZE + 1);
	repostsQuery = applyCursor(repostsQuery, repostCursor);

	const [{ data: postsRaw }, { data: repostsRaw }] = await Promise.all([postsQuery, repostsQuery]);

	const postCandidates: FeedCandidate<Record<string, any>>[] = (postsRaw ?? []).map((p: any) => ({
		...p,
		repostedBy: null,
		_sortAt: p.created_at,
		_sortId: p.id,
		_stream: 'a'
	}));
	const repostCandidates: FeedCandidate<Record<string, any>>[] = (repostsRaw ?? [])
		.filter((r: any) => r.post)
		.map((r: any) => ({
			...r.post,
			repostedBy: r.reposter,
			_sortAt: r.created_at,
			_sortId: r.id,
			_stream: 'b'
		}));

	const { page, nextCursorA, nextCursorB } = mergeFeedStreams(postCandidates, repostCandidates, PAGE_SIZE, postCursor, repostCursor);
	const cleanPage = page.map(({ _sortAt, _sortId, _stream, ...rest }) => rest) as { id: string }[];
	const embedded = await embedEngagement(supabase, cleanPage, user.id);

	const nextCursor = nextCursorA || nextCursorB ? encodeFollowingCursor({ p: nextCursorA, r: nextCursorB }) : null;

	return json({ posts: embedded, nextCursor });
};
