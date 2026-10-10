// Merges two independently keyset-paginated streams (e.g. "posts authored by
// people I follow" and "posts reposted by people I follow") into one
// chronological feed page, without losing or duplicating rows across pages.
//
// Each stream must be fetched ordered desc by its own (sortAt, sortId) and
// capped at `pageSize + 1` rows per fetch — that's always enough lookahead,
// since no single merged page of `pageSize` can need more than `pageSize + 1`
// rows from either source alone.
//
// The tricky part keyset pagination over a single table doesn't have: after
// merging and slicing to `pageSize`, a stream's next cursor must be the last
// row *from that stream that actually made the page* — not simply the last
// row fetched this round, since the other stream may have supplied fresher
// rows that pushed some of this stream's fetched rows past the cut line. A
// stream with zero representation in a given page keeps its previous cursor
// unchanged (nothing of it was consumed, so there's nothing to skip past
// next time) rather than skipping ahead and silently dropping those rows.

export type FeedCursor = { createdAt: string; id: string };

export type FeedCandidate<T> = T & {
	_sortAt: string;
	_sortId: string;
	_stream: 'a' | 'b';
};

export function mergeFeedStreams<T>(
	streamA: FeedCandidate<T>[],
	streamB: FeedCandidate<T>[],
	pageSize: number,
	previousCursorA: FeedCursor | null,
	previousCursorB: FeedCursor | null
): { page: FeedCandidate<T>[]; nextCursorA: FeedCursor | null; nextCursorB: FeedCursor | null } {
	const combined = [...streamA, ...streamB].sort((x, y) => {
		if (x._sortAt !== y._sortAt) return x._sortAt < y._sortAt ? 1 : -1;
		if (x._sortId !== y._sortId) return x._sortId < y._sortId ? 1 : -1;
		return 0;
	});

	// Both streams were fetched pageSize+1 deep; if the combined total still
	// doesn't exceed pageSize, there is nothing left in either stream.
	if (combined.length <= pageSize) {
		return { page: combined, nextCursorA: null, nextCursorB: null };
	}

	const page = combined.slice(0, pageSize);
	let lastA: FeedCandidate<T> | undefined;
	let lastB: FeedCandidate<T> | undefined;
	for (let i = page.length - 1; i >= 0; i--) {
		if (!lastA && page[i]._stream === 'a') lastA = page[i];
		if (!lastB && page[i]._stream === 'b') lastB = page[i];
		if (lastA && lastB) break;
	}

	return {
		page,
		nextCursorA: lastA ? { createdAt: lastA._sortAt, id: lastA._sortId } : previousCursorA,
		nextCursorB: lastB ? { createdAt: lastB._sortAt, id: lastB._sortId } : previousCursorB
	};
}

export type Engagement = {
	likeCount: number;
	commentCount: number;
	repostCount: number;
	likedByMe: boolean;
	repostedByMe: boolean;
};

// One batched lookup per feed page (6 queries total regardless of how many
// posts are on the page) rather than a per-post round trip. Comment count
// includes replies — they live in the same `post_comments` rows, there's no
// separate `parent_id is null` filter to apply.
export async function loadEngagement(
	supabase: any,
	postIds: string[],
	viewerId: string | null | undefined
): Promise<Record<string, Engagement>> {
	const result: Record<string, Engagement> = {};
	for (const id of postIds) {
		result[id] = { likeCount: 0, commentCount: 0, repostCount: 0, likedByMe: false, repostedByMe: false };
	}
	if (postIds.length === 0) return result;

	const [{ data: likes }, { data: comments }, { data: reposts }] = await Promise.all([
		supabase.from('post_likes').select('post_id').in('post_id', postIds),
		supabase.from('post_comments').select('post_id').in('post_id', postIds),
		supabase.from('post_reposts').select('post_id').in('post_id', postIds)
	]);
	for (const l of likes ?? []) result[l.post_id].likeCount++;
	for (const c of comments ?? []) result[c.post_id].commentCount++;
	for (const r of reposts ?? []) result[r.post_id].repostCount++;

	if (viewerId) {
		const [{ data: myLikes }, { data: myReposts }] = await Promise.all([
			supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', viewerId),
			supabase.from('post_reposts').select('post_id').in('post_id', postIds).eq('user_id', viewerId)
		]);
		for (const l of myLikes ?? []) result[l.post_id].likedByMe = true;
		for (const r of myReposts ?? []) result[r.post_id].repostedByMe = true;
	}

	return result;
}

export async function embedEngagement<T extends { id: string }>(
	supabase: any,
	posts: T[],
	viewerId: string | null | undefined
): Promise<(T & Engagement)[]> {
	const engagement = await loadEngagement(supabase, posts.map((p) => p.id), viewerId);
	return posts.map((p) => ({ ...p, ...engagement[p.id] }));
}
