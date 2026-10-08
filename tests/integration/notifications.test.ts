// Integration tests: notification *wiring* — who gets notified and who
// doesn't — not actual email delivery. notifyByEmail itself already no-ops
// safely without RESEND_API_KEY (unit-tested in email.test.ts) and nothing
// in this suite sets that secret, so no real email would go out here
// regardless; the mock below exists to make the "was the right recipient
// targeted" assertion possible, not to avoid a real send that was never
// going to happen. See helpers.ts for why these run against a real test
// project, not mocks, for everything else.

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';

const notifyByEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('$lib/server/email', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/email')>('$lib/server/email');
	return { ...actual, notifyByEmail: notifyByEmailMock };
});

import * as followRoute from '../../src/routes/api/follows/[id]/+server';
import * as commentsRoute from '../../src/routes/api/posts/[id]/comments/+server';
import * as membershipRoute from '../../src/routes/api/bands/[id]/membership/+server';
import { configured, admin, actorFor, makeUser, cleanupUser, buildEvent, callRoute, type Actor } from './helpers';

describe.skipIf(!configured)('email notification wiring (integration)', () => {
	let alice: Actor;
	let bob: Actor;
	let band: Actor;
	const created: string[] = [];

	beforeAll(async () => {
		const a = await makeUser('notif-alice', false);
		const b = await makeUser('notif-bob', false);
		const bd = await makeUser('notif-band', true);
		created.push(a.id, b.id, bd.id);
		alice = await actorFor(a.email);
		bob = await actorFor(b.email);
		band = await actorFor(bd.email);
	});

	afterAll(async () => {
		for (const id of created) await cleanupUser(id);
	});

	afterEach(() => notifyByEmailMock.mockClear());

	it('notifies the followed user when someone new follows them', async () => {
		const event = buildEvent(alice, { id: bob.user.id }, { method: 'POST', path: `/api/follows/${bob.user.id}` });
		const res = await callRoute(() => followRoute.POST(event));
		expect(res.status).toBe(200);
		expect(notifyByEmailMock).toHaveBeenCalledTimes(1);
		expect(notifyByEmailMock.mock.calls[0][0]).toBe(bob.user.id);

		// Clean up the follow row this test created.
		await admin.from('follows').delete().eq('follower_id', alice.user.id).eq('following_id', bob.user.id);
	});

	it('does not notify on unfollow', async () => {
		await admin.from('follows').insert({ follower_id: alice.user.id, following_id: bob.user.id });
		const event = buildEvent(alice, { id: bob.user.id }, { method: 'POST', path: `/api/follows/${bob.user.id}` });
		const res = await callRoute(() => followRoute.POST(event));
		expect(res.status).toBe(200);
		expect(notifyByEmailMock).not.toHaveBeenCalled();
	});

	it("notifies the post author when someone else comments", async () => {
		const { data: post, error: postError } = await admin.from('posts').insert({ author_id: alice.user.id, body: 'hi', tags: [] }).select('id').single();
		if (postError) throw postError;
		const event = buildEvent(bob, { id: post.id }, {
			method: 'POST',
			path: `/api/posts/${post.id}/comments`,
			body: { content: 'nice post', parent_id: null }
		});
		const res = await callRoute(() => commentsRoute.POST(event));
		expect(res.status).toBe(200);
		expect(notifyByEmailMock).toHaveBeenCalledTimes(1);
		expect(notifyByEmailMock.mock.calls[0][0]).toBe(alice.user.id);

		await admin.from('posts').delete().eq('id', post.id);
	});

	it('does not notify when the post author comments on their own post', async () => {
		const { data: post, error: postError } = await admin.from('posts').insert({ author_id: alice.user.id, body: 'hi', tags: [] }).select('id').single();
		if (postError) throw postError;
		const event = buildEvent(alice, { id: post.id }, {
			method: 'POST',
			path: `/api/posts/${post.id}/comments`,
			body: { content: 'my own thoughts', parent_id: null }
		});
		const res = await callRoute(() => commentsRoute.POST(event));
		expect(res.status).toBe(200);
		expect(notifyByEmailMock).not.toHaveBeenCalled();

		await admin.from('posts').delete().eq('id', post.id);
	});

	it('notifies the band when someone requests to join', async () => {
		const event = buildEvent(bob, { id: band.user.id }, { method: 'POST', path: `/api/bands/${band.user.id}/membership` });
		const res = await callRoute(() => membershipRoute.POST(event));
		expect(res.status).toBe(200);
		expect(notifyByEmailMock).toHaveBeenCalledTimes(1);
		expect(notifyByEmailMock.mock.calls[0][0]).toBe(band.user.id);
	});

	it('notifies the requester when the band accepts them', async () => {
		const event = buildEvent(band, { id: band.user.id }, {
			method: 'PATCH',
			path: `/api/bands/${band.user.id}/membership`,
			body: { member_id: bob.user.id }
		});
		const res = await callRoute(() => membershipRoute.PATCH(event));
		expect(res.status).toBe(200);
		expect(notifyByEmailMock).toHaveBeenCalledTimes(1);
		expect(notifyByEmailMock.mock.calls[0][0]).toBe(bob.user.id);

		await admin.from('band_memberships').delete().eq('band_id', band.user.id).eq('member_id', bob.user.id);
	});
});
