import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { sendEmail, nearbyEventEmail } from '$lib/server/email';
import { boundingBoxForRadius, applyBoundingBox, withinRadius } from '$lib/server/geo';
import { distanceMiles } from '$lib/geo';

export type NotificationType =
	| 'new_follower'
	| 'new_comment'
	| 'band_join_request'
	| 'band_join_accepted'
	| 'nearby_event';

type ChannelPrefs = { email?: boolean; in_app?: boolean };

// One preference PER (type, channel): every type can go out over either
// channel, and each is independently toggleable — not a single switch per
// type covering whichever channels that type happens to use. Checked once
// here so individual routes don't each need to know how preferences are
// stored.
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
			.maybeSingle<{ notification_preferences: Record<string, ChannelPrefs> }>();
		const prefs = profile?.notification_preferences?.[type];

		const tasks: Promise<unknown>[] = [];

		if (opts.inApp && (prefs?.in_app ?? true)) {
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

		if (opts.email && (prefs?.email ?? true)) {
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

const NEARBY_EVENT_DEFAULT_RADIUS_MILES = 50;
// Widest radius a recipient's own distance filter can request — the
// candidate fetch below is bounded by this, not the default, so someone who
// opts into a larger radius still gets found.
const NEARBY_EVENT_MAX_RADIUS_MILES = 250;

export type NearbyEventFilters = {
	distance?: { enabled?: boolean; max_miles?: number };
	pay?: { enabled?: boolean; min_pay?: number };
	genres?: { enabled?: boolean; values?: string[] };
};

// Each enabled filter must pass; a filter left off (the default for all
// three) never narrows anything. A filter that's enabled but has nothing
// for the event to match against (no pay listed, no genres picked) fails
// closed rather than open — can't confirm a match, so don't notify.
export function passesNearbyEventFilters(
	filters: NearbyEventFilters | undefined,
	distanceMi: number,
	eventPayMin: number | null,
	eventPayMax: number | null,
	eventGenres: string[]
): boolean {
	const distanceFilter = filters?.distance;
	const effectiveRadius = distanceFilter?.enabled ? distanceFilter.max_miles ?? NEARBY_EVENT_DEFAULT_RADIUS_MILES : NEARBY_EVENT_DEFAULT_RADIUS_MILES;
	if (distanceMi > effectiveRadius) return false;

	const payFilter = filters?.pay;
	if (payFilter?.enabled) {
		const offered = eventPayMax ?? eventPayMin;
		if (offered == null || offered < (payFilter.min_pay ?? 0)) return false;
	}

	const genreFilter = filters?.genres;
	if (genreFilter?.enabled) {
		const wanted = genreFilter.values ?? [];
		if (wanted.length === 0 || !eventGenres.some((g) => wanted.includes(g))) return false;
	}

	return true;
}

// Same bounding-box prefilter + precise Haversine recheck used by the
// "local" feed and the map pages — see src/lib/server/geo.ts.
export async function notifyNearbyUsersOfEvent(
	hostId: string,
	hostName: string,
	eventTitle: string,
	eventDate: string,
	origin: string,
	eventPayMin: number | null = null,
	eventPayMax: number | null = null,
	eventGenres: string[] = []
): Promise<void> {
	try {
		const admin = supabaseAdmin();
		const { data: host } = await admin
			.from('profiles')
			.select('location_lat, location_lng')
			.eq('id', hostId)
			.maybeSingle<{ location_lat: number | null; location_lng: number | null }>();
		if (!host?.location_lat || !host?.location_lng) return; // can't determine "nearby" without a location
		const hostLat = host.location_lat;
		const hostLng = host.location_lng;

		let query = admin
			.from('profiles')
			.select('id, location_lat, location_lng, notification_preferences')
			.eq('discoverable', true)
			.neq('id', hostId)
			.not('location_lat', 'is', null)
			.not('location_lng', 'is', null);
		query = applyBoundingBox(query, boundingBoxForRadius(hostLat, hostLng, NEARBY_EVENT_MAX_RADIUS_MILES));
		const { data: candidates } = await query;

		const inBoundingBox = withinRadius(candidates ?? [], hostLat, hostLng, NEARBY_EVENT_MAX_RADIUS_MILES);
		if (inBoundingBox.length === 0) return;

		const profileUrl = `${origin}/profile/${hostId}`;
		const { subject, html } = nearbyEventEmail(hostName, eventTitle, eventDate, profileUrl);

		await Promise.all(
			inBoundingBox.map((p: any) => {
				const distanceMi = distanceMiles(hostLat, hostLng, p.location_lat, p.location_lng);
				const filters: NearbyEventFilters | undefined = p.notification_preferences?.nearby_event?.filters;
				if (!passesNearbyEventFilters(filters, distanceMi, eventPayMin, eventPayMax, eventGenres)) return undefined;
				return notify(p.id, 'nearby_event', {
					inApp: { title: `New event near you: ${eventTitle}`, body: `Hosted by ${hostName}`, link: `/profile/${hostId}` },
					email: { subject, html }
				});
			})
		);
	} catch (err) {
		console.error('notifyNearbyUsersOfEvent failed', err);
	}
}
