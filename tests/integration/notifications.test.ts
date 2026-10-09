// Integration tests: notifications end to end — real rows in the
// `notifications` table, real preference gating, real geo fan-out for
// nearby events. Email sending itself always no-ops in this environment
// (RESEND_API_KEY is deliberately not a CI/test secret — see email.test.ts),
// so there's nothing to mock: calling the real notify()/notifyNearbyUsersOfEvent
// exercises the real logic end to end with no risk of a real send. See
// helpers.ts for why these run against a real test project, not mocks.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as followRoute from '../../src/routes/api/follows/[id]/+server';
import * as commentsRoute from '../../src/routes/api/posts/[id]/comments/+server';
import * as notificationsRoute from '../../src/routes/api/notifications/+server';
import * as notificationRoute from '../../src/routes/api/notifications/[id]/+server';
import { notifyNearbyUsersOfEvent } from '../../src/lib/server/notify';
import { configured, admin, actorFor, makeUser, cleanupUser, buildEvent, callRoute, type Actor } from './helpers';

describe.skipIf(!configured)('notifications (integration)', () => {
	let alice: Actor;
	let bob: Actor;
	const created: string[] = [];

	beforeAll(async () => {
		const a = await makeUser('notif-alice', false);
		const b = await makeUser('notif-bob', false);
		created.push(a.id, b.id);
		alice = await actorFor(a.email);
		bob = await actorFor(b.email);
	});

	afterAll(async () => {
		for (const id of created) await cleanupUser(id);
	});

	it('inserts a real in-app notification row when someone follows you', async () => {
		const event = buildEvent(alice, { id: bob.user.id }, { method: 'POST', path: `/api/follows/${bob.user.id}` });
		const res = await callRoute(() => followRoute.POST(event));
		expect(res.status).toBe(200);

		const { data: rows } = await admin
			.from('notifications')
			.select('type, title, link')
			.eq('recipient_id', bob.user.id)
			.eq('type', 'new_follower');
		expect(rows).toHaveLength(1);
		expect(rows![0].link).toBe(`/profile/${alice.user.id}`);

		await admin.from('notifications').delete().eq('recipient_id', bob.user.id).eq('type', 'new_follower');
		await admin.from('follows').delete().eq('follower_id', alice.user.id).eq('following_id', bob.user.id);
	});

	it('inserts an in-app row for comments too — every type supports both channels', async () => {
		const { data: post, error: postError } = await admin.from('posts').insert({ author_id: alice.user.id, body: 'hi', tags: [] }).select('id').single();
		if (postError) throw postError;
		const event = buildEvent(bob, { id: post.id }, {
			method: 'POST',
			path: `/api/posts/${post.id}/comments`,
			body: { content: 'nice post', parent_id: null }
		});
		const res = await callRoute(() => commentsRoute.POST(event));
		expect(res.status).toBe(200);

		const { data: rows } = await admin.from('notifications').select('id, link').eq('recipient_id', alice.user.id).eq('type', 'new_comment');
		expect(rows).toHaveLength(1);
		expect(rows![0].link).toBe(`/post/${post.id}`);

		await admin.from('notifications').delete().eq('recipient_id', alice.user.id).eq('type', 'new_comment');
		await admin.from('posts').delete().eq('id', post.id);
	});

	it('gates the in-app channel independently of the email channel', async () => {
		await admin.from('profiles').update({ notification_preferences: { new_follower: { email: true, in_app: false } } }).eq('id', bob.user.id);

		const event = buildEvent(alice, { id: bob.user.id }, { method: 'POST', path: `/api/follows/${bob.user.id}` });
		const res = await callRoute(() => followRoute.POST(event));
		expect(res.status).toBe(200);

		// in_app is off: no row, even though email is still on for this type.
		const { data: rows } = await admin.from('notifications').select('id').eq('recipient_id', bob.user.id).eq('type', 'new_follower');
		expect(rows ?? []).toHaveLength(0);

		await admin.from('follows').delete().eq('follower_id', alice.user.id).eq('following_id', bob.user.id);
		await admin.from('profiles').update({ notification_preferences: { new_follower: { email: true, in_app: true } } }).eq('id', bob.user.id);
	});

	describe('nearby event fan-out', () => {
		// Austin, ~2mi away, and ~200mi away (outside the 50mi radius).
		const HOST = { lat: 30.2672, lng: -97.7431 };
		const NEAR = { lat: 30.29, lng: -97.75 };
		const FAR = { lat: 32.78, lng: -96.8 };

		beforeAll(async () => {
			await admin.from('profiles').update({ location_lat: HOST.lat, location_lng: HOST.lng, discoverable: true }).eq('id', alice.user.id);
			await admin.from('profiles').update({ location_lat: NEAR.lat, location_lng: NEAR.lng, discoverable: true }).eq('id', bob.user.id);
		});

		it('notifies nearby discoverable profiles but not ones outside the radius', async () => {
			const far = await makeUser('notif-far', false);
			created.push(far.id);
			await admin.from('profiles').update({ location_lat: FAR.lat, location_lng: FAR.lng, discoverable: true }).eq('id', far.id);

			await notifyNearbyUsersOfEvent(alice.user.id, 'Alice', 'Open Mic Night', '2026-05-01', 'https://example.com');

			const { data: bobRows } = await admin.from('notifications').select('id').eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
			expect(bobRows).toHaveLength(1);

			const { data: farRows } = await admin.from('notifications').select('id').eq('recipient_id', far.id).eq('type', 'nearby_event');
			expect(farRows ?? []).toHaveLength(0);

			await admin.from('notifications').delete().eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
		});

		it("notifies a far user who has extended their own distance filter, and finds them even though they're past the 50mi default", async () => {
			const far = await makeUser('notif-far-extended', false);
			created.push(far.id);
			await admin
				.from('profiles')
				.update({
					location_lat: FAR.lat,
					location_lng: FAR.lng,
					discoverable: true,
					notification_preferences: { nearby_event: { email: true, in_app: true, filters: { distance: { enabled: true, max_miles: 250 } } } }
				})
				.eq('id', far.id);

			await notifyNearbyUsersOfEvent(alice.user.id, 'Alice', 'Open Mic Night', '2026-05-01', 'https://example.com');

			const { data: farRows } = await admin.from('notifications').select('id').eq('recipient_id', far.id).eq('type', 'nearby_event');
			expect(farRows).toHaveLength(1);

			await admin.from('notifications').delete().eq('recipient_id', far.id).eq('type', 'nearby_event');
			await admin.from('notifications').delete().eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
		});

		it('respects a pay filter end to end, through notifyNearbyUsersOfEvent', async () => {
			await admin
				.from('profiles')
				.update({ notification_preferences: { nearby_event: { email: true, in_app: true, filters: { pay: { enabled: true, min_pay: 100 } } } } })
				.eq('id', bob.user.id);

			await notifyNearbyUsersOfEvent(alice.user.id, 'Alice', 'Underpaid Gig', '2026-05-01', 'https://example.com', 20, 50, []);
			const { data: underpaidRows } = await admin.from('notifications').select('id').eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
			expect(underpaidRows ?? []).toHaveLength(0);

			await notifyNearbyUsersOfEvent(alice.user.id, 'Alice', 'Well-Paid Gig', '2026-05-01', 'https://example.com', 150, 200, []);
			const { data: paidRows } = await admin.from('notifications').select('id').eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
			expect(paidRows).toHaveLength(1);

			await admin.from('notifications').delete().eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
			await admin.from('profiles').update({ notification_preferences: { nearby_event: { email: true, in_app: true } } }).eq('id', bob.user.id);
		});

		it('respects a genre filter end to end, through notifyNearbyUsersOfEvent', async () => {
			await admin
				.from('profiles')
				.update({
					notification_preferences: { nearby_event: { email: true, in_app: true, filters: { genres: { enabled: true, values: ['jazz'] } } } }
				})
				.eq('id', bob.user.id);

			await notifyNearbyUsersOfEvent(alice.user.id, 'Alice', 'Metal Night', '2026-05-01', 'https://example.com', null, null, ['metal']);
			const { data: wrongGenreRows } = await admin.from('notifications').select('id').eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
			expect(wrongGenreRows ?? []).toHaveLength(0);

			await notifyNearbyUsersOfEvent(alice.user.id, 'Alice', 'Jazz Night', '2026-05-01', 'https://example.com', null, null, ['jazz', 'blues']);
			const { data: rightGenreRows } = await admin.from('notifications').select('id').eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
			expect(rightGenreRows).toHaveLength(1);

			await admin.from('notifications').delete().eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
			await admin.from('profiles').update({ notification_preferences: { nearby_event: { email: true, in_app: true } } }).eq('id', bob.user.id);
		});

		it("does nothing when the host has no location set", async () => {
			await admin.from('profiles').update({ location_lat: null, location_lng: null }).eq('id', alice.user.id);
			await notifyNearbyUsersOfEvent(alice.user.id, 'Alice', 'Open Mic Night', '2026-05-01', 'https://example.com');
			const { data: rows } = await admin.from('notifications').select('id').eq('recipient_id', bob.user.id).eq('type', 'nearby_event');
			expect(rows ?? []).toHaveLength(0);
		});
	});

	describe('notifications API routes', () => {
		let notifId: string;

		beforeAll(async () => {
			const { data } = await admin
				.from('notifications')
				.insert({ recipient_id: bob.user.id, type: 'new_follower', title: 'Test notification', link: '/profile/x' })
				.select('id')
				.single();
			notifId = data!.id;
		});

		afterAll(async () => {
			await admin.from('notifications').delete().eq('id', notifId);
		});

		it('lists the signed-in user\'s notifications with an unread count', async () => {
			const event = buildEvent(bob, {}, { method: 'GET', path: '/api/notifications' });
			const res = await callRoute(() => notificationsRoute.GET(event));
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.notifications.some((n: any) => n.id === notifId)).toBe(true);
			expect(json.unreadCount).toBeGreaterThanOrEqual(1);
		});

		it('refuses to list notifications when not signed in', async () => {
			const event = buildEvent(null, {}, { method: 'GET', path: '/api/notifications' });
			const res = await callRoute(() => notificationsRoute.GET(event));
			expect(res.status).toBe(401);
		});

		it('marks a single notification as read, scoped to its own recipient', async () => {
			const event = buildEvent(alice, { id: notifId }, { method: 'PATCH', path: `/api/notifications/${notifId}` });
			await callRoute(() => notificationRoute.PATCH(event));
			const { data } = await admin.from('notifications').select('read_at').eq('id', notifId).single();
			// alice isn't the recipient, so her request should not have marked it read
			expect(data?.read_at).toBeNull();

			const ownEvent = buildEvent(bob, { id: notifId }, { method: 'PATCH', path: `/api/notifications/${notifId}` });
			await callRoute(() => notificationRoute.PATCH(ownEvent));
			const { data: afterOwn } = await admin.from('notifications').select('read_at').eq('id', notifId).single();
			expect(afterOwn?.read_at).not.toBeNull();
		});
	});
});
