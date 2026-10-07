// Integration tests: the report-submission route (src/routes/api/posts/[id]/report).
// The admin review routes (src/routes/api/admin/reports/...) intentionally
// aren't covered here: they build their service-role client from the
// PRODUCTION project's env vars (same pattern as the existing
// api/admin/seed-venues route), which this suite — scoped to TEST_SUPABASE_*
// only, on purpose — has no business touching. Those are verified manually
// against local dev instead. See helpers.ts for why these run against a real
// test project, not mocks.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as reportRoute from '../../src/routes/api/posts/[id]/report/+server';
import { configured, admin, actorFor, makeUser, cleanupUser, buildEvent, callRoute, type Actor } from './helpers';

function eventFor(actor: Actor | null, postId: string, body?: unknown) {
	return buildEvent(actor, { id: postId }, { method: 'POST', body, path: `/api/posts/${postId}/report` });
}

describe.skipIf(!configured)('report flow (integration)', () => {
	let author: Actor;
	let reporter: Actor;
	const created: string[] = [];
	let postId: string;

	beforeAll(async () => {
		const a = await makeUser('report-author', false);
		const r = await makeUser('report-reporter', false);
		created.push(a.id, r.id);
		author = await actorFor(a.email);
		reporter = await actorFor(r.email);

		const { data: post, error } = await admin
			.from('posts')
			.insert({ author_id: author.user.id, body: 'reportable post', tags: [] })
			.select('id')
			.single();
		if (error) throw error;
		postId = post.id;
	});

	afterAll(async () => {
		if (postId) await admin.from('posts').delete().eq('id', postId);
		for (const id of created) await cleanupUser(id);
	});

	it('refuses a report from someone who is not signed in', async () => {
		const res = await callRoute(() => reportRoute.POST(eventFor(null, postId, { reason: 'spam' })));
		expect(res.status).toBe(401);
	});

	it('rejects an invalid reason', async () => {
		const res = await callRoute(() => reportRoute.POST(eventFor(reporter, postId, { reason: 'not-a-real-reason' })));
		expect(res.status).toBe(400);
	});

	it('refuses to let the author report their own post', async () => {
		const res = await callRoute(() => reportRoute.POST(eventFor(author, postId, { reason: 'spam' })));
		expect(res.status).toBe(400);
	});

	it('lets a signed-in user report a post', async () => {
		const res = await callRoute(() =>
			reportRoute.POST(eventFor(reporter, postId, { reason: 'spam', details: 'looks like a bot' }))
		);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.alreadyReported).toBe(false);

		const { data } = await admin
			.from('reports')
			.select('reason, details, status')
			.eq('post_id', postId)
			.eq('reporter_id', reporter.user.id)
			.single();
		expect(data?.reason).toBe('spam');
		expect(data?.status).toBe('pending');
	});

	it('treats a second report from the same user as already-reported, not a duplicate row', async () => {
		const res = await callRoute(() =>
			reportRoute.POST(eventFor(reporter, postId, { reason: 'harassment' }))
		);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.alreadyReported).toBe(true);

		const { data } = await admin.from('reports').select('id').eq('post_id', postId).eq('reporter_id', reporter.user.id);
		expect(data).toHaveLength(1);
	});
});
