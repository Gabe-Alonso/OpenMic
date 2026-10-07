// Integration tests: Row Level Security, checked directly against Postgres
// (never through an app route) for the tables that don't already get this
// treatment inside a feature-specific test file. post_permissions.test.ts,
// message-permissions.test.ts and band-membership.test.ts each already
// include one of these for their own table; this file covers the remaining
// gaps: profiles, follows, post_likes, post_comments, and reports. See
// helpers.ts for why these run against a real test project, not mocks.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { configured, admin, actorFor, makeUser, cleanupUser, type Actor } from './helpers';

describe.skipIf(!configured)('RLS policies (integration)', () => {
	let me: Actor;
	let other: Actor;
	const created: string[] = [];
	let postId: string;

	beforeAll(async () => {
		const m = await makeUser('rls-me', false);
		const o = await makeUser('rls-other', false);
		created.push(m.id, o.id);
		me = await actorFor(m.email);
		other = await actorFor(o.email);

		const { data: post, error } = await admin
			.from('posts')
			.insert({ author_id: me.user.id, body: 'rls test post', tags: [] })
			.select('id')
			.single();
		if (error) throw error;
		postId = post.id;
	});

	afterAll(async () => {
		if (postId) await admin.from('posts').delete().eq('id', postId);
		for (const id of created) await cleanupUser(id);
	});

	describe('profiles', () => {
		it('lets a user update their own profile', async () => {
			const { error } = await me.client.from('profiles').update({ bio: 'updated by self' }).eq('id', me.user.id);
			expect(error).toBeNull();
			const { data } = await admin.from('profiles').select('bio').eq('id', me.user.id).single();
			expect(data?.bio).toBe('updated by self');
		});

		it("blocks a direct update of someone else's profile", async () => {
			const { data } = await other.client
				.from('profiles')
				.update({ bio: 'hacked' })
				.eq('id', me.user.id)
				.select();
			expect(data ?? []).toHaveLength(0);
			const { data: unchanged } = await admin.from('profiles').select('bio').eq('id', me.user.id).single();
			expect(unchanged?.bio).not.toBe('hacked');
		});
	});

	describe('follows', () => {
		let followId: string;

		afterAll(async () => {
			if (followId) await admin.from('follows').delete().eq('id', followId);
		});

		it('lets a user create their own follow row', async () => {
			const { data, error } = await me.client
				.from('follows')
				.insert({ follower_id: me.user.id, following_id: other.user.id })
				.select('id')
				.single();
			expect(error).toBeNull();
			followId = data?.id;
		});

		it('blocks inserting a follow row that impersonates another follower', async () => {
			const { data, error } = await other.client
				.from('follows')
				.insert({ follower_id: me.user.id, following_id: other.user.id })
				.select();
			expect(data ?? []).toHaveLength(0);
			expect(error).not.toBeNull();
		});

		it("blocks deleting someone else's follow row directly", async () => {
			const { data } = await other.client.from('follows').delete().eq('id', followId).select();
			expect(data ?? []).toHaveLength(0);
			const { data: stillThere } = await admin.from('follows').select('id').eq('id', followId).maybeSingle();
			expect(stillThere).not.toBeNull();
		});
	});

	describe('post_likes', () => {
		let likeId: string;

		beforeAll(async () => {
			const { data, error } = await admin
				.from('post_likes')
				.insert({ post_id: postId, user_id: me.user.id })
				.select('id')
				.single();
			if (error) throw error;
			likeId = data.id;
		});

		afterAll(async () => {
			if (likeId) await admin.from('post_likes').delete().eq('id', likeId);
		});

		it('blocks inserting a like that impersonates another user', async () => {
			const { data, error } = await other.client
				.from('post_likes')
				.insert({ post_id: postId, user_id: me.user.id })
				.select();
			expect(data ?? []).toHaveLength(0);
			expect(error).not.toBeNull();
		});

		it("blocks deleting someone else's like directly", async () => {
			const { data } = await other.client.from('post_likes').delete().eq('id', likeId).select();
			expect(data ?? []).toHaveLength(0);
			const { data: stillThere } = await admin.from('post_likes').select('id').eq('id', likeId).maybeSingle();
			expect(stillThere).not.toBeNull();
		});
	});

	describe('post_comments', () => {
		let commentId: string;

		beforeAll(async () => {
			const { data, error } = await admin
				.from('post_comments')
				.insert({ post_id: postId, author_id: me.user.id, content: 'original comment' })
				.select('id')
				.single();
			if (error) throw error;
			commentId = data.id;
		});

		afterAll(async () => {
			if (commentId) await admin.from('post_comments').delete().eq('id', commentId);
		});

		it('blocks inserting a comment that impersonates another author', async () => {
			const { data, error } = await other.client
				.from('post_comments')
				.insert({ post_id: postId, author_id: me.user.id, content: 'impersonated' })
				.select();
			expect(data ?? []).toHaveLength(0);
			expect(error).not.toBeNull();
		});

		it("blocks updating someone else's comment directly", async () => {
			const { data } = await other.client
				.from('post_comments')
				.update({ content: 'hacked' })
				.eq('id', commentId)
				.select();
			expect(data ?? []).toHaveLength(0);
			const { data: unchanged } = await admin.from('post_comments').select('content').eq('id', commentId).single();
			expect(unchanged?.content).toBe('original comment');
		});

		it("blocks deleting someone else's comment directly", async () => {
			const { data } = await other.client.from('post_comments').delete().eq('id', commentId).select();
			expect(data ?? []).toHaveLength(0);
			const { data: stillThere } = await admin.from('post_comments').select('id').eq('id', commentId).maybeSingle();
			expect(stillThere).not.toBeNull();
		});
	});

	describe('reports', () => {
		let reportId: string;

		afterAll(async () => {
			if (reportId) await admin.from('reports').delete().eq('id', reportId);
		});

		it('lets a user create a report as themselves', async () => {
			const { data, error } = await other.client
				.from('reports')
				.insert({ post_id: postId, reporter_id: other.user.id, reason: 'spam' })
				.select('id')
				.single();
			expect(error).toBeNull();
			reportId = data?.id;
		});

		it('blocks creating a report that impersonates another reporter', async () => {
			const { data, error } = await me.client
				.from('reports')
				.insert({ post_id: postId, reporter_id: other.user.id, reason: 'spam' })
				.select();
			expect(data ?? []).toHaveLength(0);
			expect(error).not.toBeNull();
		});

		it("blocks reading another user's reports", async () => {
			const { data } = await me.client.from('reports').select('id').eq('id', reportId);
			expect(data ?? []).toHaveLength(0);
		});

		it('blocks updating a report directly, even your own — only an admin route can change its status', async () => {
			const { data } = await other.client
				.from('reports')
				.update({ status: 'dismissed' })
				.eq('id', reportId)
				.select();
			expect(data ?? []).toHaveLength(0);
			const { data: unchanged } = await admin.from('reports').select('status').eq('id', reportId).single();
			expect(unchanged?.status).toBe('pending');
		});
	});
});
