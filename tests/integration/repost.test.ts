// Integration tests: the repost toggle endpoint, and its RLS. Mirrors the
// existing like endpoint's toggle pattern exactly (same insert/delete/count
// shape), so the main thing worth proving here is the toggle itself and that
// RLS, not just the route's own `user_id = auth.uid()` filter, is what
// actually blocks reposting as someone else.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as repostRoute from '../../src/routes/api/posts/[id]/repost/+server';
import { configured, admin, actorFor, makeUser, cleanupUser, buildEvent, callRoute, type Actor } from './helpers';

function eventFor(actor: Actor | null, postId: string) {
	return buildEvent(actor, { id: postId }, { method: 'POST', path: `/api/posts/${postId}/repost` });
}

describe.skipIf(!configured)('repost toggle (integration)', () => {
	let author: Actor;
	let reposter: Actor;
	const created: string[] = [];
	let postId: string;

	beforeAll(async () => {
		const a = await makeUser('repost-author', false);
		const r = await makeUser('repost-reposter', false);
		created.push(a.id, r.id);
		author = await actorFor(a.email);
		reposter = await actorFor(r.email);
	});

	afterAll(async () => {
		for (const id of created) await cleanupUser(id);
	});

	beforeEach(async () => {
		const { data, error } = await admin
			.from('posts')
			.insert({ author_id: author.user.id, body: 'repost me', tags: [] })
			.select('id')
			.single();
		if (error) throw error;
		postId = data.id;
	});

	it('refuses an unauthenticated repost', async () => {
		const res = await callRoute(() => repostRoute.POST(eventFor(null, postId)));
		expect(res.status).toBe(401);
	});

	it('reposts on first call, un-reposts on second call', async () => {
		const first = await callRoute(() => repostRoute.POST(eventFor(reposter, postId)));
		expect(first.status).toBe(200);
		const firstBody = await first.json();
		expect(firstBody.reposted).toBe(true);
		expect(firstBody.count).toBe(1);

		const { data: row } = await admin.from('post_reposts').select('id').eq('post_id', postId).eq('user_id', reposter.user.id).maybeSingle();
		expect(row).not.toBeNull();

		const second = await callRoute(() => repostRoute.POST(eventFor(reposter, postId)));
		const secondBody = await second.json();
		expect(secondBody.reposted).toBe(false);
		expect(secondBody.count).toBe(0);

		const { data: rowAfter } = await admin.from('post_reposts').select('id').eq('post_id', postId).eq('user_id', reposter.user.id).maybeSingle();
		expect(rowAfter).toBeNull();
	});

	it('blocks a direct database insert that reposts as someone else', async () => {
		const { data, error } = await reposter.client
			.from('post_reposts')
			.insert({ post_id: postId, user_id: author.user.id })
			.select();
		expect(data ?? []).toHaveLength(0);
		expect(error).not.toBeNull();
	});

	it('is idempotent against the unique constraint under a direct duplicate insert', async () => {
		await admin.from('post_reposts').insert({ post_id: postId, user_id: reposter.user.id });
		const { data, error } = await reposter.client
			.from('post_reposts')
			.insert({ post_id: postId, user_id: reposter.user.id })
			.select();
		expect(data ?? []).toHaveLength(0);
		expect(error).not.toBeNull();
	});
});
