// Integration tests: who can edit or delete a post. See helpers.ts for how
// and why these run against a real test project instead of mocks.
//
// The route scopes its update/delete to `author_id = <caller>`, so a
// non-author's request matches zero rows and the route still returns 200.
// That means the route's response can't prove anything by itself — the real
// guarantee has to be the database's row-level security. These tests check
// both: that the route is well-behaved, and that the database would still
// refuse the write even if the route's own filter were ever removed.

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import * as postRoute from '../../src/routes/api/posts/[id]/+server';
import { configured, admin, actorFor, makeUser, cleanupUser, buildEvent, callRoute, type Actor } from './helpers';

function eventFor(actor: Actor | null, postId: string, init: { method: string; body?: unknown }) {
	return buildEvent(actor, { id: postId }, { ...init, path: `/api/posts/${postId}` });
}

describe.skipIf(!configured)('post permissions (integration)', () => {
	let author: Actor;
	let other: Actor;
	const created: string[] = [];
	let postId: string;

	beforeAll(async () => {
		const a = await makeUser('post-author', false);
		const o = await makeUser('post-outsider', false);
		created.push(a.id, o.id);
		author = await actorFor(a.email);
		other = await actorFor(o.email);
	});

	afterAll(async () => {
		for (const id of created) await cleanupUser(id);
		if (postId) await admin.from('posts').delete().eq('id', postId);
	});

	beforeEach(async () => {
		const { data, error } = await admin
			.from('posts')
			.insert({ author_id: author.user.id, body: 'original body', tags: [] })
			.select('id')
			.single();
		if (error) throw error;
		postId = data.id;
	});

	it('refuses an edit from someone who is not signed in', async () => {
		const res = await callRoute(() => postRoute.PATCH(eventFor(null, postId, { method: 'PATCH', body: { body: 'hacked' } })));
		expect(res.status).toBe(401);
	});

	it("does not change another user's post, even though the route reports ok", async () => {
		const res = await callRoute(() => postRoute.PATCH(eventFor(other, postId, { method: 'PATCH', body: { body: 'hacked' } })));
		expect(res.status).toBe(200); // the route itself can't tell 0 rows matched from 1
		const { data } = await admin.from('posts').select('body').eq('id', postId).single();
		expect(data?.body).toBe('original body');
	});

	it("does not delete another user's post, even though the route reports ok", async () => {
		const res = await callRoute(() => postRoute.DELETE(eventFor(other, postId, { method: 'DELETE' })));
		expect(res.status).toBe(200);
		const { data } = await admin.from('posts').select('id').eq('id', postId).maybeSingle();
		expect(data).not.toBeNull();
	});

	it('blocks a direct database update that skips the author_id filter entirely', async () => {
		// The strongest version of the test above: bypass the route's own
		// scoping and ask the database directly. RLS, not app code, is what
		// has to refuse this.
		const { data } = await other.client
			.from('posts')
			.update({ body: 'hacked via direct RLS bypass attempt' })
			.eq('id', postId)
			.select();
		expect(data ?? []).toHaveLength(0);
		const { data: unchanged } = await admin.from('posts').select('body').eq('id', postId).single();
		expect(unchanged?.body).toBe('original body');
	});

	it('lets the author edit their own post', async () => {
		const res = await callRoute(() => postRoute.PATCH(eventFor(author, postId, { method: 'PATCH', body: { body: 'updated body' } })));
		expect(res.status).toBe(200);
		const { data } = await admin.from('posts').select('body, edited_at').eq('id', postId).single();
		expect(data?.body).toBe('updated body');
		expect(data?.edited_at).not.toBeNull();
	});

	it('lets the author delete their own post', async () => {
		const res = await callRoute(() => postRoute.DELETE(eventFor(author, postId, { method: 'DELETE' })));
		expect(res.status).toBe(200);
		const { data } = await admin.from('posts').select('id').eq('id', postId).maybeSingle();
		expect(data).toBeNull();
		postId = ''; // already gone, nothing for afterAll to clean up
	});
});
