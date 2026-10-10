<script lang="ts">
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import PostCard from '$lib/components/PostCard.svelte';
	import VenueReviews from '$lib/components/VenueReviews.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let openApplySlotId = $state<string | null>(null);
	let applyMessage = $state('');

	const profile = $derived(data.profile);

	let userFollows = $state(untrack(() => data.userFollows));
	let followerCount = $state(untrack(() => data.followerCount));
	let toggling = $state(false);
	let followBtnHovered = $state(false);

	type MemberProfile = { id: string; full_name: string | null; avatar_url: string | null };
	let members = $state<MemberProfile[]>(untrack(() => data.members));
	let pendingRequests = $state<MemberProfile[]>(untrack(() => data.pendingRequests));
	let membershipStatus = $state<'pending' | 'accepted' | null>(untrack(() => data.viewerMembershipStatus));
	let membershipBusy = $state(false);
	let membershipHovered = $state(false);

	async function requestJoin() {
		if (membershipBusy) return;
		membershipBusy = true;
		const res = await fetch(`/api/bands/${profile.id}/membership`, { method: 'POST' });
		if (res.ok) membershipStatus = 'pending';
		else if (res.status === 401) goto('/signin');
		membershipBusy = false;
	}

	async function leaveBand() {
		if (membershipBusy) return;
		membershipBusy = true;
		const res = await fetch(`/api/bands/${profile.id}/membership`, { method: 'DELETE' });
		if (res.ok) membershipStatus = null;
		membershipBusy = false;
	}

	async function acceptMember(memberId: string) {
		const res = await fetch(`/api/bands/${profile.id}/membership`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ member_id: memberId })
		});
		if (!res.ok) return;
		const req = pendingRequests.find((p) => p.id === memberId);
		pendingRequests = pendingRequests.filter((p) => p.id !== memberId);
		if (req) members = [...members, req];
	}

	async function removeMember(memberId: string) {
		const res = await fetch(`/api/bands/${profile.id}/membership?member_id=${memberId}`, { method: 'DELETE' });
		if (res.ok) members = members.filter((m) => m.id !== memberId);
	}

	async function declineMember(memberId: string) {
		const res = await fetch(`/api/bands/${profile.id}/membership?member_id=${memberId}`, { method: 'DELETE' });
		if (res.ok) pendingRequests = pendingRequests.filter((p) => p.id !== memberId);
	}

	function getInitial(): string {
		const name = profile?.full_name || profile?.id;
		return name?.[0]?.toUpperCase() ?? '?';
	}

	async function toggleFollow() {
		if (toggling) return;
		toggling = true;
		const wasFollowing = userFollows;
		userFollows = !wasFollowing;
		followerCount += wasFollowing ? -1 : 1;

		const res = await fetch(`/api/follows/${profile.id}`, { method: 'POST' });
		if (res.ok) {
			const json = await res.json();
			followerCount = json.followerCount;
			userFollows = json.following;
		} else {
			userFollows = wasFollowing;
			followerCount += wasFollowing ? 1 : -1;
			if (res.status === 401) goto('/signin');
		}
		toggling = false;
	}

	function formatMutuals(mutuals: { id: string; full_name: string | null }[]): string {
		const shown = mutuals.slice(0, 3);
		const names = shown.map((m) => m.full_name ?? 'someone').join(', ');
		const extra = mutuals.length - 3;
		if (extra > 0) return `${names} ... and ${extra} more`;
		return names;
	}

	type ListProfile = { id: string; full_name: string | null; avatar_url: string | null };
	let dmLoading = $state(false);

	async function startDM() {
		if (dmLoading) return;
		dmLoading = true;
		try {
			const res = await fetch('/api/messages/conversations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ other_user_id: profile.id })
			});
			if (res.status === 401) { goto('/signin'); return; }
			if (res.ok) {
				const { conversationId } = await res.json();
				goto(`/messages/${conversationId}`);
			}
		} finally {
			dmLoading = false;
		}
	}

	let followModal = $state<{ type: 'followers' | 'following'; list: ListProfile[] } | null>(null);
	let loadingModal = $state(false);

	async function openFollowModal(type: 'followers' | 'following') {
		loadingModal = true;
		followModal = { type, list: [] };
		const res = await fetch(`/api/follows/${profile.id}/list?type=${type}`);
		if (res.ok) followModal = { type, list: await res.json() };
		loadingModal = false;
	}

	function closeFollowModal() {
		followModal = null;
	}

	// Calendar
	const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
	let calYear = $state(new Date().getFullYear());
	let calMonth = $state(new Date().getMonth());
	let selectedDay = $state<string | null>(null);

	function dateKey(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	}
	const monthLabel = $derived(`${MONTH_NAMES[calMonth]} ${calYear}`);
	function prevMonth() {
		if (calMonth === 0) { calMonth = 11; calYear--; } else calMonth--;
		selectedDay = null;
	}
	function nextMonth() {
		if (calMonth === 11) { calMonth = 0; calYear++; } else calMonth++;
		selectedDay = null;
	}
	const calGrid = $derived.by(() => {
		const firstDay = new Date(calYear, calMonth, 1);
		const lastDay = new Date(calYear, calMonth + 1, 0);
		const startDow = firstDay.getDay();
		const cells: { date: Date; isCurrentMonth: boolean }[] = [];
		for (let i = 0; i < startDow; i++) {
			cells.push({ date: new Date(calYear, calMonth, 1 - (startDow - i)), isCurrentMonth: false });
		}
		for (let d = 1; d <= lastDay.getDate(); d++) {
			cells.push({ date: new Date(calYear, calMonth, d), isCurrentMonth: true });
		}
		const rem = (7 - (cells.length % 7)) % 7;
		for (let i = 1; i <= rem; i++) {
			cells.push({ date: new Date(calYear, calMonth + 1, i), isCurrentMonth: false });
		}
		return cells;
	});
	const eventsByDate = $derived.by(() => {
		const map = new Map<string, any[]>();
		for (const ev of (data as any).venueEvents ?? []) {
			if (!map.has(ev.date)) map.set(ev.date, []);
			map.get(ev.date)!.push(ev);
		}
		return map;
	});
	function formatTime(t: string | null | undefined): string {
		if (!t) return '';
		const [h, m] = t.split(':').map(Number);
		const ampm = h >= 12 ? 'PM' : 'AM';
		const hour = h % 12 || 12;
		return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
	}
	function formatPay(payMin: number | null, payMax: number | null): string {
		if (payMin && payMax && payMin !== payMax) return `$${payMin}–$${payMax}`;
		if (payMin || payMax) return `$${payMin ?? payMax}`;
		return '';
	}
	function formatSelectedDay(dateStr: string): string {
		const [y, mo, d] = dateStr.split('-').map(Number);
		return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	}
</script>

<div class="public-profile">

	<section class="hero-card">
		<div class="hero-band">
			{#if (profile as any).banner_url}
				<img src={(profile as any).banner_url} alt="" class="band-img" />
				<div class="band-overlay" aria-hidden="true"></div>
			{:else}
				<div class="band-dots" aria-hidden="true"></div>
				<div class="band-ring-a" aria-hidden="true"></div>
				<div class="band-ring-b" aria-hidden="true"></div>
				<div class="band-blob" aria-hidden="true"></div>
			{/if}
		</div>

		<div class="hero-body">
			<div class="profile-header">
				<div class="header-left">
					<div class="avatar-wrap">
						{#if profile.avatar_url}
							<img src={profile.avatar_url} alt={profile.full_name ?? 'Profile'} class="avatar-img" />
						{:else}
							<div class="avatar-circle">{getInitial()}</div>
						{/if}
					</div>
					<div class="header-info">
						<h1 class="display-name">{profile.full_name ?? 'Anonymous Artist'}</h1>
						{#if profile.location}
							<p class="location">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z" />
									<circle cx="12" cy="10" r="3" />
								</svg>
								{profile.location}
							</p>
						{/if}
					</div>
				</div>

				{#if !data.isOwnProfile}
					<div class="profile-actions">
						<button
							class="follow-btn"
							class:is-following={userFollows}
							class:hovered={followBtnHovered && userFollows}
							onmouseenter={() => (followBtnHovered = true)}
							onmouseleave={() => (followBtnHovered = false)}
							onclick={toggleFollow}
							disabled={toggling}
						>
							{#if toggling}
								<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"/></svg>
							{:else if userFollows && followBtnHovered}
								Unfollow
							{:else if userFollows}
								Following
							{:else}
								Follow
							{/if}
						</button>
						{#if (profile as any).is_band && data.user && !data.viewerIsBand}
							{#if membershipStatus === null}
								<button class="membership-btn" onclick={requestJoin} disabled={membershipBusy}>Request to join</button>
							{:else if membershipStatus === 'pending'}
								<button
									class="membership-btn requested"
									onmouseenter={() => (membershipHovered = true)}
									onmouseleave={() => (membershipHovered = false)}
									onclick={leaveBand}
									disabled={membershipBusy}
								>{membershipHovered ? 'Cancel request' : 'Requested'}</button>
							{:else}
								<button class="membership-btn requested" onclick={leaveBand} disabled={membershipBusy}>Leave band</button>
							{/if}
						{/if}
						{#if data.user}
							<button class="message-btn" onclick={startDM} disabled={dmLoading} aria-label="Message">
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
									<polyline points="22,6 12,13 2,6"/>
								</svg>
								Message
							</button>
						{/if}
					</div>
				{/if}
			</div>

			<div class="chips-stats-row">
				{#if (profile as any).is_band || (profile as any).artist_roles?.length > 0 || (profile as any).tags?.length > 0}
					<div class="role-chips">
						{#if (profile as any).is_band}
							<span class="chip band-chip">Band / Collective</span>
						{/if}
						{#each (profile as any).artist_roles ?? [] as role}
							<span class="chip role-chip">{role}</span>
						{/each}
						{#each (profile as any).tags ?? [] as tag}
							<span class="chip">#{tag}</span>
						{/each}
					</div>
				{:else}
					<span></span>
				{/if}
				<div class="follow-stats">
					<button class="stat stat-btn" onclick={() => openFollowModal('followers')}><strong>{followerCount}</strong> Followers</button>
					<span class="stat-dot" aria-hidden="true"></span>
					<button class="stat stat-btn" onclick={() => openFollowModal('following')}><strong>{data.followingCount}</strong> Following</button>
				</div>
			</div>

			{#if (profile as any).is_band}
				<div class="members-row">
					<span class="members-label">Members</span>
					{#if members.length > 0}
						<div class="member-list">
							{#each members as m (m.id)}
								<div class="member-item">
									<a href="/profile/{m.id}" class="member-chip">
										<span class="member-avatar">
											{#if m.avatar_url}
												<img src={m.avatar_url} alt="" />
											{:else}
												{m.full_name?.[0]?.toUpperCase() ?? '?'}
											{/if}
										</span>
										<span class="member-name">{m.full_name ?? 'Anonymous Artist'}</span>
									</a>
									{#if data.isOwnProfile}
										<button class="remove-member" onclick={() => removeMember(m.id)} aria-label="Remove {m.full_name ?? 'member'}">×</button>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<p class="members-empty">No members yet.</p>
					{/if}
				</div>
			{/if}

			{#if data.mutuals.length > 0}
				<div class="mutuals-row">
					<div class="mutual-avatars">
						{#each data.mutuals.slice(0, 3) as m}
							<div class="mutual-avatar" title={m.full_name ?? ''}>
								{#if m.avatar_url}
									<img src={m.avatar_url} alt={m.full_name ?? ''} />
								{:else}
									<div class="mutual-initial">{m.full_name?.[0]?.toUpperCase() ?? '?'}</div>
								{/if}
							</div>
						{/each}
					</div>
					<span class="mutuals-text">Followed by {formatMutuals(data.mutuals)}</span>
				</div>
			{/if}
		</div>
	</section>

	<div class="profile-body">
		<div class="main-col">
			{#if (profile as any).profile_type === 'venue'}
				<section class="card">
					<h2 class="card-title">Reviews</h2>
					<VenueReviews
						venueProfileId={profile.id}
						currentUserId={data.user?.id ?? null}
						canReview={!!data.user && !data.isOwnProfile}
					/>
				</section>
			{/if}

			{#if data.isOwnProfile && (profile as any).is_band && pendingRequests.length > 0}
				<section class="card">
					<h2 class="card-title">Join requests</h2>
					<div class="request-list">
						{#each pendingRequests as p (p.id)}
							<div class="request-item">
								<a href="/profile/{p.id}" class="request-person">
									<span class="member-avatar">
										{#if p.avatar_url}
											<img src={p.avatar_url} alt="" />
										{:else}
											{p.full_name?.[0]?.toUpperCase() ?? '?'}
										{/if}
									</span>
									<span class="member-name">{p.full_name ?? 'Anonymous Artist'}</span>
								</a>
								<div class="request-actions">
									<button class="accept-btn" onclick={() => acceptMember(p.id)}>Accept</button>
									<button class="decline-btn" onclick={() => declineMember(p.id)}>Decline</button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if profile.bio}
				<section class="card">
					<h2 class="card-title">About</h2>
					<p class="bio">{profile.bio}</p>
				</section>
			{/if}

			<section class="card">
				<h2 class="card-title">Posts</h2>
				{#if data.posts.length > 0}
					<div class="posts-list">
						{#each data.posts as post}
							<PostCard {post} likeCount={data.likeCounts[post.id] ?? 0} />
						{/each}
					</div>
				{:else}
					<div class="empty-state">
						<span class="empty-icon">🎵</span>
						<p class="empty-title">Nothing here yet</p>
						<p class="empty-sub">This artist hasn't posted anything yet.</p>
					</div>
				{/if}
			</section>
		</div>

		<aside class="aside-col">
			<section class="card" aria-label="Events">
				<div class="cal-header">
					<h2 class="card-title">Events</h2>
					<div class="cal-nav">
						<button class="cal-nav-btn" onclick={prevMonth} aria-label="Previous month">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
						</button>
						<span class="cal-month-label">{monthLabel}</span>
						<button class="cal-nav-btn" onclick={nextMonth} aria-label="Next month">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
						</button>
					</div>
				</div>

				<div class="cal-grid">
					{#each ['Su','Mo','Tu','We','Th','Fr','Sa'] as dow}
						<div class="cal-dow">{dow}</div>
					{/each}
					{#each calGrid as cell (dateKey(cell.date))}
						{@const key = dateKey(cell.date)}
						{@const hasEvs = eventsByDate.has(key)}
						<button
							class="cal-day"
							class:other-month={!cell.isCurrentMonth}
							class:has-events={hasEvs}
							class:selected={selectedDay === key}
							onclick={() => { selectedDay = selectedDay === key ? null : key; }}
						>
							<span class="day-num">{cell.date.getDate()}</span>
							{#if hasEvs}<span class="event-dot"></span>{/if}
						</button>
					{/each}
				</div>

				{#if selectedDay}
					<div class="day-panel">
						<h3 class="day-panel-title">{formatSelectedDay(selectedDay)}</h3>
						{#each (eventsByDate.get(selectedDay) ?? []) as ev (ev.id)}
							<div class="event-item">
								<div class="event-time-badge">
									{#if ev.start_time}
										{formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
									{:else}
										All day
									{/if}
								</div>
								<div class="event-info">
									<p class="event-title">{ev.title}</p>
									{#if ev.description}<p class="event-desc">{ev.description}</p>{/if}
									{#if ev.pay_min || ev.pay_max}
										<p class="event-pay">{formatPay(ev.pay_min, ev.pay_max)}</p>
									{/if}
									{#if ev.genres?.length}
										<div class="event-genre-tags">
											{#each ev.genres as g}<span class="event-genre-tag">#{g}</span>{/each}
										</div>
									{/if}
									{#if (ev.slots ?? []).length > 0}
										<div class="slots-list">
											{#each ev.slots as slot (slot.id)}
												{@const myStatus = (data as any).myApplicationBySlot?.[slot.id]}
												<div class="slot-row">
													<span class="slot-row-time">
														{#if slot.start_time}
															{slot.start_time}{slot.end_time ? `–${slot.end_time}` : ''}
														{:else}
															Slot
														{/if}
													</span>
													{#if slot.status === 'filled' && slot.artist}
														<a href="/profile/{slot.artist.id}" class="slot-filled-link">
															<span class="slot-mini-avatar">
																{#if slot.artist.avatar_url}
																	<img src={slot.artist.avatar_url} alt="" />
																{:else}
																	{slot.artist.full_name?.[0]?.toUpperCase() ?? '?'}
																{/if}
															</span>
															{slot.artist.full_name ?? 'Artist'}
														</a>
													{:else if data.user && !data.isOwnProfile && myStatus === 'pending'}
														<div class="slot-vacant-row">
															<span class="slot-vacant-label">Vacant — application pending</span>
															<form method="POST" action="?/withdrawApplication" use:enhance>
																<input type="hidden" name="slot_id" value={slot.id} />
																<button type="submit" class="slot-withdraw-btn">Withdraw</button>
															</form>
														</div>
													{:else if data.user && !data.isOwnProfile && myStatus === 'accepted'}
														<span class="slot-vacant-label">You're booked for this slot!</span>
													{:else if data.user && !data.isOwnProfile}
														<div class="slot-vacant-row">
															<span class="slot-vacant-label">Vacant</span>
															<button
																type="button"
																class="slot-apply-btn"
																onclick={() => { openApplySlotId = openApplySlotId === slot.id ? null : slot.id; applyMessage = ''; }}
															>
																{openApplySlotId === slot.id ? 'Cancel' : 'Apply'}
															</button>
														</div>
														{#if openApplySlotId === slot.id}
															<form
																method="POST"
																action="?/applyToSlot"
																use:enhance={() => async ({ update }) => { await update(); openApplySlotId = null; }}
																class="slot-apply-form"
															>
																<input type="hidden" name="slot_id" value={slot.id} />
																<textarea name="message" rows="2" placeholder="Optional message to the venue…" bind:value={applyMessage} maxlength="1000"></textarea>
																<button type="submit" class="btn btn-primary">Submit Application</button>
															</form>
														{/if}
													{:else}
														<span class="slot-vacant-label">Vacant</span>
													{/if}
												</div>
												{#if form && 'applyError' in form && form.applyError && openApplySlotId === null}
													<p class="slot-apply-error">{form.applyError}</p>
												{/if}
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{/each}
						{#if !(eventsByDate.get(selectedDay)?.length)}
							<p class="no-events-msg">No events scheduled for this day.</p>
						{/if}
					</div>
				{:else if ((data as any).venueEvents ?? []).length === 0}
					<p class="cal-empty">No events scheduled yet.</p>
				{/if}
			</section>

			{#if profile.contact_email || profile.instagram}
				<section class="card">
					<h2 class="card-title">Contact</h2>
					<div class="contact-list">
						{#if profile.contact_email}
							<a href="mailto:{profile.contact_email}" class="contact-item">
								<span class="contact-icon">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<rect width="20" height="16" x="2" y="4" rx="2" />
										<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
									</svg>
								</span>
								{profile.contact_email}
							</a>
						{/if}
						{#if profile.instagram}
							<a href="https://instagram.com/{profile.instagram}" target="_blank" rel="noopener noreferrer" class="contact-item">
								<span class="contact-icon">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
										<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
										<line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
									</svg>
								</span>
								@{profile.instagram}
							</a>
						{/if}
					</div>
				</section>
			{/if}
		</aside>
	</div>

</div>

{#if followModal}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(e) => { if (e.key === 'Escape') closeFollowModal(); }}
		onclick={(e) => { if (e.target === e.currentTarget) closeFollowModal(); }}
	>
		<div class="modal">
			<div class="modal-header">
				<h2 class="modal-title">{followModal.type === 'followers' ? 'Followers' : 'Following'}</h2>
				<button class="modal-close" onclick={closeFollowModal} aria-label="Close">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
			{#if loadingModal}
				<p class="modal-empty">Loading…</p>
			{:else if followModal.list.length === 0}
				<p class="modal-empty">No {followModal.type === 'followers' ? 'followers' : 'following'} yet.</p>
			{:else}
				<ul class="modal-list">
					{#each followModal.list as person (person.id)}
						<li>
							<a href="/profile/{person.id}" class="modal-person" onclick={closeFollowModal}>
								<div class="modal-avatar">
									{#if person.avatar_url}
										<img src={person.avatar_url} alt={person.full_name ?? ''} />
									{:else}
										<span>{person.full_name?.[0]?.toUpperCase() ?? '?'}</span>
									{/if}
								</div>
								<span class="modal-name">{person.full_name ?? 'Anonymous Artist'}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}

<style>
	.public-profile {
		max-width: 1160px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card-lg);
		padding: 36px;
	}

	.role-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.role-chip {
		background: var(--color-ink);
		color: var(--color-cream);
	}

	/* Hero card */
	.hero-card {
		overflow: hidden;
		border-radius: var(--radius-panel);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: 0 20px 50px rgba(76, 29, 149, 0.1);
	}

	.hero-band {
		position: relative;
		height: 168px;
		background: var(--color-ink);
		overflow: hidden;
	}

	.band-dots {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
		background-size: 26px 26px;
	}

	.band-ring-a {
		position: absolute;
		right: -80px;
		top: -150px;
		width: 420px;
		height: 420px;
		border-radius: 50%;
		border: 1px solid rgba(196, 181, 253, 0.25);
	}

	.band-ring-b {
		position: absolute;
		right: 20px;
		top: -90px;
		width: 300px;
		height: 300px;
		border-radius: 50%;
		border: 1px solid rgba(196, 181, 253, 0.35);
	}

	.band-blob {
		position: absolute;
		right: 120px;
		top: -30px;
		width: 160px;
		height: 160px;
		border-radius: 50%;
		background: var(--color-primary);
		opacity: 0.55;
	}

	.band-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.band-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(23, 8, 47, 0) 0%, rgba(23, 8, 47, 0.45) 100%);
	}

	.hero-body {
		padding: 0 40px 32px;
	}

	/* Header */
	.profile-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px;
	}

	.header-left {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 24px;
	}

	.avatar-wrap {
		position: relative;
		z-index: 2;
		flex-shrink: 0;
		margin-top: -64px;
	}

	.avatar-img {
		width: 128px;
		height: 128px;
		border-radius: 50%;
		object-fit: cover;
		border: 6px solid var(--color-surface);
		box-shadow: 0 14px 30px rgba(76, 29, 149, 0.3);
	}

	.avatar-circle {
		width: 128px;
		height: 128px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		font-family: var(--font-display);
		font-size: 2.5rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 6px solid var(--color-surface);
		box-shadow: 0 14px 30px rgba(76, 29, 149, 0.3);
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-bottom: 4px;
	}

	.display-name {
		font-size: clamp(1.75rem, 4.6vw, 2.5rem);
		line-height: 1;
		margin: 0;
	}

	.chips-stats-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-top: 24px;
	}

	.follow-stats {
		display: flex;
		align-items: center;
		gap: 20px;
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.stat strong {
		color: var(--color-text);
		font-weight: 700;
		font-size: 1.0625rem;
	}

	.stat-dot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--color-border-strong);
	}

	.location {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Profile action buttons */
	.profile-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.message-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 0 18px;
		border-radius: var(--radius-pill);
		font-size: 0.875rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
		background: var(--color-surface);
		color: var(--color-primary-deep);
		border: 1.5px solid var(--color-border-strong);
	}

	.message-btn:hover:not(:disabled) {
		background: var(--color-primary-light);
	}

	.message-btn:disabled {
		opacity: 0.7;
		cursor: default;
	}

	/* Follow button */
	.follow-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		min-height: 44px;
		padding: 0 24px;
		border-radius: var(--radius-pill);
		font-size: 0.875rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
		background: var(--color-primary);
		color: white;
		border: 1.5px solid var(--color-primary);
		box-shadow: var(--shadow-btn);
	}

	.follow-btn:hover:not(.is-following):not(:disabled) {
		background: var(--color-primary-dark);
		border-color: var(--color-primary-dark);
	}

	.follow-btn.is-following {
		background: none;
		color: var(--color-text);
		border-color: var(--color-border);
		box-shadow: none;
	}

	.follow-btn.is-following.hovered {
		border-color: #dc2626;
		color: #dc2626;
		background: #fff8f8;
	}

	.follow-btn:disabled {
		opacity: 0.7;
		cursor: default;
	}

	.spin {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Mutuals */
	.mutuals-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid var(--color-border-soft);
	}

	.mutual-avatars {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.mutual-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--color-surface);
		flex-shrink: 0;
	}

	.mutual-avatar + .mutual-avatar {
		margin-left: -6px;
	}

	.mutual-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.mutual-initial {
		width: 100%;
		height: 100%;
		background: var(--color-primary-bright);
		color: white;
		font-size: 0.6rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mutuals-text {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	/* Two-column body */
	.profile-body {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 20px;
	}

	.main-col {
		flex: 999 1 520px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.aside-col {
		flex: 1 1 340px;
		max-width: 440px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.bio {
		font-size: 1.0625rem;
		line-height: 1.7;
		color: var(--color-text-body);
		white-space: pre-wrap;
		margin: 0;
	}

	/* Contact */
	.contact-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.contact-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px;
		border-radius: 18px;
		background: var(--color-surface-tint);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		text-decoration: none;
		transition: background 0.15s;
	}

	.contact-item:hover {
		background: var(--color-primary-light);
	}

	.contact-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 14px;
		background: var(--color-primary-light);
		color: var(--color-primary);
		flex-shrink: 0;
	}

	/* Posts */
	.posts-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.card-title {
		font-size: 1.625rem;
		margin: 0 0 16px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 40px 0;
		text-align: center;
	}

	.empty-icon {
		font-size: 2rem;
		margin-bottom: 4px;
	}

	.empty-title {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 800;
	}

	.empty-sub {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		max-width: 340px;
		line-height: 1.5;
	}

	/* Stat buttons */
	.stat-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-size: inherit;
		color: inherit;
		font-family: inherit;
	}

	.stat-btn:hover {
		text-decoration: underline;
	}

	/* Follow modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-card-hover);
		width: 360px;
		max-width: calc(100vw - 32px);
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 20px 14px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.modal-title {
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
	}

	.modal-close {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		padding: 4px;
		border-radius: var(--radius-sm);
		transition: color 0.15s;
	}

	.modal-close:hover {
		color: var(--color-text);
	}

	.modal-list {
		list-style: none;
		margin: 0;
		padding: 8px;
		overflow-y: auto;
	}

	.modal-person {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: var(--color-text);
		transition: background 0.15s;
	}

	.modal-person:hover {
		background: var(--color-bg);
	}

	.modal-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--color-primary-bright);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.modal-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.modal-avatar span {
		color: white;
		font-weight: 700;
		font-size: 0.95rem;
	}

	.modal-name {
		font-size: 0.9rem;
		font-weight: 500;
	}

	.modal-empty {
		padding: 32px 20px;
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	/* Calendar */
	.cal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}
	.cal-header .card-title {
		margin-bottom: 0;
	}
	.cal-nav {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.cal-nav-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 5px 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		color: var(--color-text-muted);
		transition: background 0.15s, color 0.15s;
	}
	.cal-nav-btn:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}
	.cal-month-label {
		font-size: 0.9rem;
		font-weight: 600;
		min-width: 140px;
		text-align: center;
	}
	.cal-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		margin-bottom: 12px;
	}
	.cal-dow {
		text-align: center;
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--color-text-muted);
		padding: 6px 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.cal-day {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		border: 1.5px solid transparent;
		background: none;
		cursor: pointer;
		transition: background 0.1s, border-color 0.1s;
		gap: 3px;
		font-family: inherit;
		min-width: 0;
		padding: 0;
	}
	.cal-day:hover:not(.other-month) {
		background: var(--color-bg);
	}
	.day-num {
		font-size: 0.85rem;
		font-weight: 500;
		line-height: 1;
	}
	.cal-day.other-month .day-num {
		color: var(--color-text-muted);
		opacity: 0.35;
	}
	.event-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--color-primary-bright);
		flex-shrink: 0;
	}
	.cal-day.has-events:not(.selected) {
		background: var(--color-primary-light);
	}
	.cal-day.selected {
		border-color: var(--color-primary);
		background: var(--color-primary);
	}
	.cal-day.selected .day-num {
		color: white;
	}
	.cal-day.selected .event-dot {
		background: white;
	}
	.day-panel {
		border-top: 1px solid var(--color-border);
		padding-top: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.day-panel-title {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}
	.event-item {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	.event-time-badge {
		font-size: 0.78rem;
		color: var(--color-primary-deep);
		font-weight: 600;
		white-space: nowrap;
		padding-top: 2px;
		min-width: 90px;
	}
	.event-info .event-title {
		font-size: 0.9rem;
		font-weight: 600;
		margin: 0;
	}
	.event-desc {
		font-size: 0.825rem;
		color: var(--color-text-muted);
		margin: 4px 0 0;
		line-height: 1.5;
	}
	.event-pay {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-primary-deep);
		margin: 6px 0 0;
	}
	.event-genre-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 6px;
	}
	.event-genre-tag {
		font-size: 0.7rem;
		padding: 2px 8px;
		background: var(--color-primary-light);
		color: var(--color-primary-deep);
		border-radius: 999px;
		font-weight: 600;
	}
	.no-events-msg {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-align: center;
		padding: 16px 0;
		margin: 0;
	}
	.slots-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px dashed var(--color-border);
	}
	.slot-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.8125rem;
	}
	.slot-row-time {
		font-weight: 700;
		color: var(--color-text-muted);
	}
	.slot-vacant-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.slot-vacant-label {
		color: var(--color-text-muted);
	}
	.slot-apply-btn, .slot-withdraw-btn {
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface);
		border-radius: var(--radius-pill);
		padding: 3px 10px;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.slot-filled-link {
		display: flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--color-text-strong);
		font-weight: 600;
	}
	.slot-mini-avatar {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--color-ink);
		color: var(--color-cream);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 700;
		overflow: hidden;
		flex-shrink: 0;
	}
	.slot-mini-avatar img { width: 100%; height: 100%; object-fit: cover; }
	.slot-apply-form {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.slot-apply-form textarea {
		width: 100%;
		padding: 6px 8px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		font-family: inherit;
		resize: vertical;
	}
	.slot-apply-error {
		font-size: 0.75rem;
		color: var(--color-danger);
		margin: 2px 0 0;
	}
	.cal-empty {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-align: center;
		padding: 20px 0 8px;
		border-top: 1px solid var(--color-border);
		margin-top: 4px;
	}

	/* Band */
	.band-chip {
		background: var(--color-primary);
		color: white;
	}

	.membership-btn {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		min-height: 44px;
		padding: 0 22px;
		border-radius: var(--radius-pill);
		font-size: 0.875rem;
		font-weight: 700;
		cursor: pointer;
		background: var(--color-primary);
		color: white;
		border: 1.5px solid var(--color-primary);
		box-shadow: var(--shadow-btn);
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}

	.membership-btn.requested {
		background: none;
		color: var(--color-text);
		border-color: var(--color-border);
		box-shadow: none;
	}

	.membership-btn:hover:not(:disabled):not(.requested) {
		background: var(--color-primary-dark);
	}

	.membership-btn:disabled {
		opacity: 0.7;
		cursor: default;
	}

	.members-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid var(--color-border-soft);
	}

	.members-label {
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.member-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.member-chip,
	.request-person {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 4px 14px 4px 4px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-tint);
		border: 1px solid var(--color-border);
		color: var(--color-text);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
	}

	.member-chip:hover {
		background: var(--color-primary-light);
	}

	.member-item {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.remove-member {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}

	.remove-member:hover {
		color: var(--color-danger);
		border-color: var(--color-danger-border);
		background: var(--color-danger-bg);
	}

	.member-avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		background: var(--color-primary-bright);
		color: white;
		font-weight: 700;
		font-size: 0.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.member-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.members-empty {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.request-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.request-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.request-actions {
		display: flex;
		gap: 8px;
	}

	.accept-btn,
	.decline-btn {
		min-height: 36px;
		padding: 0 16px;
		border-radius: var(--radius-pill);
		font-size: 0.8125rem;
		font-weight: 700;
		cursor: pointer;
		font-family: inherit;
	}

	.accept-btn {
		background: var(--color-primary);
		color: white;
		border: 1.5px solid var(--color-primary);
	}

	.decline-btn {
		background: none;
		color: var(--color-text-muted);
		border: 1.5px solid var(--color-border);
	}

	@media (max-width: 640px) {
		.hero-body {
			padding: 0 20px 24px;
		}

		.avatar-wrap {
			margin-top: -48px;
		}

		.avatar-img,
		.avatar-circle {
			width: 88px;
			height: 88px;
		}

		.header-left {
			align-items: center;
		}
	}
</style>
