// Integration tests: who can message whom. Covers the message-request flow —
// a DM to someone who doesn't follow you back starts "pending" and only the
// recipient accepting it unlocks two-way messaging — plus the basic rule that
// only conversation participants can post into it at all. See helpers.ts.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as conversationsRoute from '../../src/routes/api/messages/conversations/+server';
import * as conversationRoute from '../../src/routes/api/messages/conversations/[id]/+server';
import * as messagesRoute from '../../src/routes/api/messages/conversations/[id]/messages/+server';
import { configured, admin, actorFor, makeUser, cleanupUser, buildEvent, callRoute, type Actor } from './helpers';

function eventFor(actor: Actor | null, params: Record<string, string>, init: { method: string; body?: unknown; path: string }) {
	return buildEvent(actor, params, init);
}

describe.skipIf(!configured)('message permissions (integration)', () => {
	let sender: Actor;
	let recipient: Actor;
	let outsider: Actor;
	const created: string[] = [];
	let conversationId: string;

	beforeAll(async () => {
		// Neither follows the other, so the first message starts a "request".
		const s = await makeUser('msg-sender', false);
		const r = await makeUser('msg-recipient', false);
		const o = await makeUser('msg-outsider', false);
		created.push(s.id, r.id, o.id);
		sender = await actorFor(s.email);
		recipient = await actorFor(r.email);
		outsider = await actorFor(o.email);
	});

	afterAll(async () => {
		if (conversationId) await admin.from('conversations').delete().eq('id', conversationId);
		for (const id of created) await cleanupUser(id);
	});

	it('starts a pending request when the recipient does not follow the sender', async () => {
		const res = await callRoute(() =>
			conversationsRoute.POST(
				eventFor(sender, {}, { method: 'POST', path: '/api/messages/conversations', body: { other_user_id: recipient.user.id } })
			)
		);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.requestStatus).toBe('pending');
		conversationId = json.conversationId;
	});

	it('lets the sender keep messaging while their own request is pending', async () => {
		const res = await callRoute(() =>
			messagesRoute.POST(
				eventFor(sender, { id: conversationId }, {
					method: 'POST',
					path: `/api/messages/conversations/${conversationId}/messages`,
					body: { message_type: 'text', content: 'hi there' }
				})
			)
		);
		expect(res.status).toBe(200);
	});

	it('blocks the recipient from replying until they accept the request', async () => {
		const res = await callRoute(() =>
			messagesRoute.POST(
				eventFor(recipient, { id: conversationId }, {
					method: 'POST',
					path: `/api/messages/conversations/${conversationId}/messages`,
					body: { message_type: 'text', content: 'should not be allowed yet' }
				})
			)
		);
		expect(res.status).toBe(403);
	});

	it('blocks anyone who is not a participant, pending or not', async () => {
		const res = await callRoute(() =>
			messagesRoute.POST(
				eventFor(outsider, { id: conversationId }, {
					method: 'POST',
					path: `/api/messages/conversations/${conversationId}/messages`,
					body: { message_type: 'text', content: 'I should not be here' }
				})
			)
		);
		expect(res.status).toBe(403);
	});

	it('refuses to let the sender accept their own request', async () => {
		const res = await callRoute(() =>
			conversationRoute.PATCH(
				eventFor(sender, { id: conversationId }, {
					method: 'PATCH',
					path: `/api/messages/conversations/${conversationId}`,
					body: { action: 'accept' }
				})
			)
		);
		expect(res.status).toBe(403);
	});

	it('lets the recipient accept the request', async () => {
		const res = await callRoute(() =>
			conversationRoute.PATCH(
				eventFor(recipient, { id: conversationId }, {
					method: 'PATCH',
					path: `/api/messages/conversations/${conversationId}`,
					body: { action: 'accept' }
				})
			)
		);
		expect(res.status).toBe(200);
		const { data } = await admin.from('conversations').select('request_status').eq('id', conversationId).single();
		expect(data?.request_status).toBeNull();
	});

	it('lets the recipient message freely once accepted', async () => {
		const res = await callRoute(() =>
			messagesRoute.POST(
				eventFor(recipient, { id: conversationId }, {
					method: 'POST',
					path: `/api/messages/conversations/${conversationId}/messages`,
					body: { message_type: 'text', content: 'thanks, accepted!' }
				})
			)
		);
		expect(res.status).toBe(200);
	});

	it('still blocks a non-participant after the request is accepted', async () => {
		const res = await callRoute(() =>
			messagesRoute.POST(
				eventFor(outsider, { id: conversationId }, {
					method: 'POST',
					path: `/api/messages/conversations/${conversationId}/messages`,
					body: { message_type: 'text', content: 'still should not work' }
				})
			)
		);
		expect(res.status).toBe(403);
	});

	it('blocks a direct database read of the conversation by a non-participant', async () => {
		// RLS, not just the route: an outsider cannot even see this conversation.
		const { data } = await outsider.client.from('conversations').select('id').eq('id', conversationId);
		expect(data ?? []).toHaveLength(0);
	});
});
