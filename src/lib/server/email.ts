import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

// Unlike PRIVATE_ADMIN_EMAIL etc., RESEND_API_KEY is genuinely optional —
// absent in CI/test and in local dev unless explicitly configured — so this
// uses $env/dynamic/private (resolved at runtime) rather than
// $env/static/private, which would require the var to exist at build time.
const FROM_ADDRESS = 'OpenMic <notifications@openmic.gabriel-alonso.com>';

let resend: Resend | null = null;
function getResend(): Resend | null {
	if (!env.RESEND_API_KEY) return null;
	if (!resend) resend = new Resend(env.RESEND_API_KEY);
	return resend;
}

// Sends, or quietly does nothing if email isn't configured or the send
// fails for any reason — a notification should never be able to break the
// action (follow, comment, join request...) that triggered it. Preference
// checks and recipient lookup happen in notify.ts, one level up; this is
// just the mechanics of actually sending.
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
	const client = getResend();
	if (!client) return;
	try {
		await client.emails.send({ from: FROM_ADDRESS, to, subject, html });
	} catch (err) {
		console.error('sendEmail failed', err);
	}
}

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function newFollowerEmail(followerName: string, profileUrl: string) {
	const name = escapeHtml(followerName);
	return {
		subject: `${followerName} started following you on OpenMic`,
		html: `<p><strong>${name}</strong> just started following you on OpenMic.</p><p><a href="${profileUrl}">View their profile</a></p>`
	};
}

export function newCommentEmail(commenterName: string, commentText: string, postUrl: string) {
	const name = escapeHtml(commenterName);
	const preview = escapeHtml(commentText.slice(0, 200));
	return {
		subject: `${commenterName} commented on your post`,
		html: `<p><strong>${name}</strong> commented on your post:</p><p>"${preview}"</p><p><a href="${postUrl}">View the post</a></p>`
	};
}

export function bandJoinRequestEmail(requesterName: string, bandProfileUrl: string) {
	const name = escapeHtml(requesterName);
	return {
		subject: `${requesterName} wants to join your band`,
		html: `<p><strong>${name}</strong> has requested to join your band on OpenMic.</p><p><a href="${bandProfileUrl}">Review the request</a></p>`
	};
}

export function bandJoinAcceptedEmail(bandName: string, bandProfileUrl: string) {
	const name = escapeHtml(bandName);
	return {
		subject: `You're in! ${bandName} accepted your request`,
		html: `<p><strong>${name}</strong> accepted your request to join. You're officially a member.</p><p><a href="${bandProfileUrl}">View the band's profile</a></p>`
	};
}

export function nearbyEventEmail(hostName: string, eventTitle: string, eventDate: string, profileUrl: string) {
	const host = escapeHtml(hostName);
	const title = escapeHtml(eventTitle);
	return {
		subject: `New event near you: ${eventTitle}`,
		html: `<p><strong>${host}</strong> just posted an event near you: <strong>${title}</strong> on ${escapeHtml(eventDate)}.</p><p><a href="${profileUrl}">View details</a></p>`
	};
}
