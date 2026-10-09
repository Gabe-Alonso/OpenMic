import { error, fail } from '@sveltejs/kit';
import { notify } from '$lib/server/notify';
import { slotApplicationEmail } from '$lib/server/email';
import type { Actions, PageServerLoad } from './$types';

type MutualProfile = { id: string; full_name: string | null; avatar_url: string | null };

async function getMutuals(
	supabase: any,
	currentUserId: string,
	targetId: string
): Promise<MutualProfile[]> {
	const { data: userFollowings } = await supabase
		.from('follows')
		.select('following_id')
		.eq('follower_id', currentUserId);

	const followingIds = (userFollowings ?? [])
		.map((f: any) => f.following_id)
		.filter((id: string) => id !== targetId);

	if (followingIds.length === 0) return [];

	const [{ data: mutualFollowers }, { data: mutualFollowings }] = await Promise.all([
		supabase
			.from('follows')
			.select('follower_id')
			.eq('following_id', targetId)
			.in('follower_id', followingIds),
		supabase
			.from('follows')
			.select('following_id')
			.eq('follower_id', targetId)
			.in('following_id', followingIds)
	]);

	const mutualIds = new Set([
		...(mutualFollowers ?? []).map((f: any) => f.follower_id),
		...(mutualFollowings ?? []).map((f: any) => f.following_id)
	]);

	if (mutualIds.size === 0) return [];

	const { data: profiles } = await supabase
		.from('profiles')
		.select('id, full_name, avatar_url')
		.in('id', [...mutualIds])
		.limit(50);

	return profiles ?? [];
}

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!profile) throw error(404, 'Profile not found');

	const { data: posts } = await supabase
		.from('posts')
		.select('*, post_media(*)')
		.eq('author_id', params.id)
		.order('created_at', { ascending: false });

	const postsData = posts ?? [];
	const likeCounts: Record<string, number> = {};
	if (postsData.length > 0) {
		const { data: likes } = await supabase
			.from('post_likes')
			.select('post_id')
			.in('post_id', postsData.map((p: any) => p.id));
		for (const like of likes ?? []) {
			likeCounts[like.post_id] = (likeCounts[like.post_id] ?? 0) + 1;
		}
	}

	const isOwnProfile = user?.id === params.id;

	const [followersRes, followingRes, userFollowsRes] = await Promise.all([
		supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', params.id),
		supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', params.id),
		user && !isOwnProfile
			? supabase
					.from('follows')
					.select('id')
					.eq('follower_id', user.id)
					.eq('following_id', params.id)
					.maybeSingle()
			: Promise.resolve({ data: null })
	]);

	const mutuals =
		user && !isOwnProfile ? await getMutuals(supabase, user.id, params.id) : [];

	const { data: venueEventsRaw } = await supabase
		.from('venue_events')
		.select(
			`*, slots:event_slots(id, start_time, end_time, status,
				artist:profiles!artist_profile_id(id, full_name, avatar_url))`
		)
		.eq('profile_id', params.id)
		.order('date', { ascending: true });

	let myApplicationBySlot: Record<string, 'pending' | 'accepted' | 'rejected'> = {};
	if (user) {
		const slotIds = (venueEventsRaw ?? []).flatMap((e: any) => (e.slots ?? []).map((s: any) => s.id));
		if (slotIds.length > 0) {
			const { data: myApplications } = await supabase
				.from('slot_applications')
				.select('slot_id, status')
				.eq('artist_profile_id', user.id)
				.in('slot_id', slotIds);
			for (const a of myApplications ?? []) myApplicationBySlot[a.slot_id] = a.status;
		}
	}

	type MemberProfile = { id: string; full_name: string | null; avatar_url: string | null };
	let members: MemberProfile[] = [];
	let pendingRequests: MemberProfile[] = [];
	let viewerMembershipStatus: 'pending' | 'accepted' | null = null;
	let viewerIsBand = false;

	if (user) {
		const { data: viewerProfile } = await supabase
			.from('profiles').select('is_band').eq('id', user.id).maybeSingle();
		viewerIsBand = !!viewerProfile?.is_band;
	}

	if ((profile as any).is_band) {
		const { data: rows } = await supabase
			.from('band_memberships')
			.select('member_id, status, member:profiles!member_id(id, full_name, avatar_url)')
			.eq('band_id', params.id);

		for (const row of (rows ?? []) as any[]) {
			if (row.status === 'accepted') members.push(row.member);
			else if (isOwnProfile) pendingRequests.push(row.member);
			if (user && row.member_id === user.id) viewerMembershipStatus = row.status;
		}
	}

	return {
		profile,
		posts: postsData,
		likeCounts,
		followerCount: followersRes.count ?? 0,
		followingCount: followingRes.count ?? 0,
		userFollows: !!userFollowsRes.data,
		isOwnProfile,
		mutuals,
		venueEvents: venueEventsRaw ?? [],
		myApplicationBySlot,
		members,
		pendingRequests,
		viewerMembershipStatus,
		viewerIsBand
	};
};

export const actions: Actions = {
	applyToSlot: async ({ params, request, url, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { applyError: 'Sign in to apply.' });

		const data = await request.formData();
		const slotId = data.get('slot_id') as string;
		const message = (data.get('message') as string) || null;
		if (message && message.length > 1000) return fail(400, { applyError: 'Message must be 1000 characters or fewer' });

		const { error: insertErr } = await supabase.from('slot_applications').insert({
			slot_id: slotId,
			artist_profile_id: user.id,
			message
		});
		if (insertErr) return fail(400, { applyError: 'This slot is no longer accepting applications.' });

		const { data: slot } = await supabase
			.from('event_slots')
			.select('event_id, event:venue_events(id, title, profile_id)')
			.eq('id', slotId)
			.maybeSingle<{ event_id: string; event: { id: string; title: string; profile_id: string } }>();
		const { data: applicantProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();

		if (slot?.event) {
			const manageUrl = `${url.origin}/profile/events/${slot.event.id}`;
			const { subject, html } = slotApplicationEmail(applicantProfile?.full_name ?? 'An artist', slot.event.title, manageUrl);
			await notify(slot.event.profile_id, 'slot_application', {
				inApp: {
					title: `${applicantProfile?.full_name ?? 'An artist'} applied to perform at ${slot.event.title}`,
					link: manageUrl
				},
				email: { subject, html }
			});
		}

		return { applied: true, slotId };
	},

	withdrawApplication: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { applyError: 'Sign in to manage your applications.' });

		const data = await request.formData();
		const slotId = data.get('slot_id') as string;

		const { error: deleteErr } = await supabase
			.from('slot_applications')
			.delete()
			.eq('slot_id', slotId)
			.eq('artist_profile_id', user.id)
			.eq('status', 'pending');
		if (deleteErr) return fail(500, { applyError: deleteErr.message });

		return { withdrawn: true, slotId };
	}
};
