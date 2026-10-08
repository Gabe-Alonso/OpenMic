import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { sendEmail, nearbyEventEmail } from '$lib/server/email';
import { boundingBoxForRadius, applyBoundingBox, withinRadius } from '$lib/server/geo';

export type NotificationType =
	| 'new_follower'
	| 'new_comment'
	| 'band_join_request'
	| 'band_join_accepted'
	| 'nearby_event';

// One preference per type, not per (type, channel): a single toggle covers
// every channel that type happens to use. Checked once here so individual
// routes don't each need to know how preferences are stored.
export async function notify(
	recipientId: string,
	type: NotificationType,
	opts: {
		inApp?: { title: string; body?: string; link?: string };
		email?: { subject: string; html: string };
	}
): Promise<void> {
	try {
		const admin = supabaseAdmin();
		const { data: profile } = await admin
			.from('profiles')
			.select('notification_preferences')
			.eq('id', recipientId)
			.maybeSingle<{ notification_preferences: Record<string, boolean> }>();
		const enabled = profile?.notification_preferences?.[type] ?? true;
		if (!enabled) return;

		const tasks: Promise<unknown>[] = [];

		if (opts.inApp) {
			tasks.push(
				Promise.resolve(
					admin.from('notifications').insert({
						recipient_id: recipientId,
						type,
						title: opts.inApp.title,
						body: opts.inApp.body ?? null,
						link: opts.inApp.link ?? null
					})
				)
			);
		}

		if (opts.email) {
			tasks.push(
				admin.auth.admin.getUserById(recipientId).then(({ data }) => {
					const to = data?.user?.email;
					return to ? sendEmail(to, opts.email!.subject, opts.email!.html) : undefined;
				})
			);
		}

		await Promise.all(tasks);
	} catch (err) {
		// A notification should never be able to break the action that
		// triggered it (a follow, a comment, a join request...).
		console.error('notify failed', err);
	}
}

const NEARBY_EVENT_RADIUS_MILES = 50;

// Same bounding-box prefilter + precise Haversine recheck used by the
// "local" feed and the map pages — see src/lib/server/geo.ts.
export async function notifyNearbyUsersOfEvent(
	hostId: string,
	hostName: string,
	eventTitle: string,
	eventDate: string,
	origin: string
): Promise<void> {
	try {
		const admin = supabaseAdmin();
		const { data: host } = await admin
			.from('profiles')
			.select('location_lat, location_lng')
			.eq('id', hostId)
			.maybeSingle<{ location_lat: number | null; location_lng: number | null }>();
		if (!host?.location_lat || !host?.location_lng) return; // can't determine "nearby" without a location

		let query = admin
			.from('profiles')
			.select('id, location_lat, location_lng')
			.eq('discoverable', true)
			.neq('id', hostId)
			.not('location_lat', 'is', null)
			.not('location_lng', 'is', null);
		query = applyBoundingBox(query, boundingBoxForRadius(host.location_lat, host.location_lng, NEARBY_EVENT_RADIUS_MILES));
		const { data: candidates } = await query;

		const nearby = withinRadius(candidates ?? [], host.location_lat, host.location_lng, NEARBY_EVENT_RADIUS_MILES);
		if (nearby.length === 0) return;

		const profileUrl = `${origin}/profile/${hostId}`;
		const { subject, html } = nearbyEventEmail(hostName, eventTitle, eventDate, profileUrl);

		await Promise.all(
			nearby.map((p: any) =>
				notify(p.id, 'nearby_event', {
					inApp: { title: `New event near you: ${eventTitle}`, body: `Hosted by ${hostName}`, link: `/profile/${hostId}` },
					email: { subject, html }
				})
			)
		);
	} catch (err) {
		console.error('notifyNearbyUsersOfEvent failed', err);
	}
}
