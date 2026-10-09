// Integration test: the following feed includes posts reposted by someone
// the viewer follows, even when the original author isn't followed, tagged
// with who reposted it — and does NOT pull in that unfollowed author's other,
// un-reposted posts. The merge-pagination algorithm itself (correctly
// resuming two independently-paginated streams across pages) is unit-tested
// in src/lib/server/feed.test.ts; this just proves the route wires the two
// real tables together correctly for a single page.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET as followingGet } from '../../src/routes/api/community/following/+server';
import { configured, admin, buildEvent, callRoute, actorFor, makeUser, cleanupUser, type Actor } from './helpers';

function followingEvent(actor: Actor | null, query = '') {
	return buildEvent(actor, {}, { method: 'GET', path: `/api/community/following${query}` });
}

describe.skipIf(!configured)('following feed with reposts (integration)', () => {
	let viewer: Actor;
	let followedAuthor: Actor;
	let followedReposter: Actor;
	let unfollowedAuthor: Actor;
	const created: string[] = [];
	const postIds: string[] = [];

	let authoredPostId: string;
	let repostedPostId: string;
	let unrelatedPostId: string;

	beforeAll(async () => {
		const v = await makeUser('feed-viewer', false);
		const fa = await makeUser('feed-followed-author', false);
		const fr = await makeUser('feed-followed-reposter', false);
		const ua = await makeUser('feed-unfollowed-author', false);
		created.push(v.id, fa.id, fr.id, ua.id);
		viewer = await actorFor(v.email);
		followedAuthor = await actorFor(fa.email);
		followedReposter = await actorFor(fr.email);
		unfollowedAuthor = await actorFor(ua.email);

		await admin.from('follows').insert([
			{ follower_id: viewer.user.id, following_id: followedAuthor.user.id },
			{ follower_id: viewer.user.id, following_id: followedReposter.user.id }
		]);

		const { data: p1 } = await admin
			.from('posts')
			.insert({ author_id: followedAuthor.user.id, body: 'authored directly', tags: [] })
			.select('id')
			.single();
		authoredPostId = p1!.id;
		postIds.push(authoredPostId);

		const { data: p2 } = await admin
			.from('posts')
			.insert({ author_id: unfollowedAuthor.user.id, body: 'reposted into view', tags: [] })
			.select('id')
			.single();
		repostedPostId = p2!.id;
		postIds.push(repostedPostId);

		const { data: p3 } = await admin
			.from('posts')
			.insert({ author_id: unfollowedAuthor.user.id, body: 'should stay invisible', tags: [] })
			.select('id')
			.single();
		unrelatedPostId = p3!.id;
		postIds.push(unrelatedPostId);

		// Reposted after both plain posts exist, so it's the most recent feed
		// entry by construction.
		await admin.from('post_reposts').insert({ post_id: repostedPostId, user_id: followedReposter.user.id });
	});

	afterAll(async () => {
		await admin.from('post_reposts').delete().in('post_id', postIds);
		await admin.from('follows').delete().eq('follower_id', viewer.user.id);
		await admin.from('posts').delete().in('id', postIds);
		for (const id of created) await cleanupUser(id);
	});

	it('refuses an unauthenticated request', async () => {
		const res = await callRoute(() => followingGet(followingEvent(null)));
		expect(res.status).toBe(401);
	});

	it('includes a repost of an unfollowed author, tagged with the reposter, and excludes that author\'s other posts', async () => {
		const res = await callRoute(() => followingGet(followingEvent(viewer)));
		expect(res.status).toBe(200);
		const body = await res.json();
		const ids = body.posts.map((p: any) => p.id);

		expect(ids).toContain(authoredPostId);
		expect(ids).toContain(repostedPostId);
		expect(ids).not.toContain(unrelatedPostId);

		const repostedEntry = body.posts.find((p: any) => p.id === repostedPostId);
		expect(repostedEntry.repostedBy?.id).toBe(followedReposter.user.id);

		const authoredEntry = body.posts.find((p: any) => p.id === authoredPostId);
		expect(authoredEntry.repostedBy).toBeNull();

		// The repost happened after both posts were authored, so it should
		// rank first in the merged, chronologically-sorted feed.
		expect(ids[0]).toBe(repostedPostId);
	});

	it('embeds like/comment/repost counts and the viewer\'s own liked/reposted state', async () => {
		await admin.from('post_likes').insert({ post_id: repostedPostId, user_id: viewer.user.id });
		const res = await callRoute(() => followingGet(followingEvent(viewer)));
		const body = await res.json();
		const entry = body.posts.find((p: any) => p.id === repostedPostId);

		expect(entry.likeCount).toBe(1);
		expect(entry.likedByMe).toBe(true);
		expect(entry.repostCount).toBe(1);
		expect(entry.repostedByMe).toBe(false);

		await admin.from('post_likes').delete().eq('post_id', repostedPostId).eq('user_id', viewer.user.id);
	});
});
