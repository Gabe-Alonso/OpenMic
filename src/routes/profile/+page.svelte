<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { createClient } from '$lib/supabase';
	import { resizeImage } from '$lib/resizeImage';
	import LocationSearch from '$lib/components/LocationSearch.svelte';
	import TagInput from '$lib/components/TagInput.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const supabase = createClient();
	const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

	let profileTags = $state<string[]>(data.profile?.tags ?? []);
	let profileType = $state<string>((data.profile as any)?.profile_type ?? 'artist');
	let artistRoles = $state<string[]>((data.profile as any)?.artist_roles ?? []);

	const ARTIST_ROLES = ['Instrumentalist', 'Producer', 'Composer', 'Sound Tech', 'Other'];

	function toggleRole(role: string) {
		if (artistRoles.includes(role)) {
			artistRoles = artistRoles.filter((r) => r !== role);
		} else {
			artistRoles = [...artistRoles, role];
		}
	}

	// Calendar state (venue profiles only)
	const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
	let calYear = $state(new Date().getFullYear());
	let calMonth = $state(new Date().getMonth());
	let selectedDay = $state<string | null>(null);

	type VenueEvent = { id: string; title: string; date: string; start_time: string | null; end_time: string | null; description: string | null };
	let eventModal = $state<{ editing?: VenueEvent; prefillDate?: string } | null>(null);

	$effect(() => {
		if ((form as any)?.eventCreated || (form as any)?.eventUpdated) {
			eventModal = null;
		}
	});

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
	function formatSelectedDay(dateStr: string): string {
		const [y, mo, d] = dateStr.split('-').map(Number);
		return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	}
	function openAddEvent() {
		eventModal = { prefillDate: selectedDay ?? undefined };
	}
	function openEditEvent(ev: VenueEvent) {
		eventModal = { editing: ev };
	}

	let confirmDelete = $state(false);
	let avatarPreview = $state<string | null>(null);
	let avatarUploading = $state(false);
	let avatarError = $state<string | null>(null);
	let bannerPreview = $state<string | null>(null);
	let bannerUploading = $state(false);
	let bannerError = $state<string | null>(null);

	function getInitial(): string {
		const name = data.profile?.full_name || data.user?.email;
		return name?.[0]?.toUpperCase() ?? '?';
	}

	async function handleAvatarChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (file.size > MAX_FILE_SIZE) {
			avatarError = `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.`;
			input.value = '';
			return;
		}

		avatarError = null;
		avatarUploading = true;

		const resized = await resizeImage(file, 512); // avatars never render larger than a few hundred px
		avatarPreview = URL.createObjectURL(resized);

		const ext = resized.name.split('.').pop()?.toLowerCase() ?? 'jpg';
		const path = `${data.user.id}/avatar.${ext}`;

		const { error: uploadError } = await supabase.storage
			.from('avatars')
			.upload(path, resized, { upsert: true });

		if (uploadError) {
			avatarError = uploadError.message;
			avatarPreview = null;
			avatarUploading = false;
			return;
		}

		const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
		const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

		const { error: updateError } = await supabase
			.from('profiles')
			.update({ avatar_url: publicUrl })
			.eq('id', data.user.id);

		if (updateError) {
			avatarError = updateError.message;
		}

		await invalidateAll();
		avatarUploading = false;
	}

	async function handleBannerChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (file.size > MAX_FILE_SIZE) {
			bannerError = `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.`;
			input.value = '';
			return;
		}

		bannerError = null;
		bannerUploading = true;

		const resized = await resizeImage(file);
		bannerPreview = URL.createObjectURL(resized);

		const ext = resized.name.split('.').pop()?.toLowerCase() ?? 'jpg';
		const path = `${data.user.id}/banner.${ext}`;

		const { error: uploadError } = await supabase.storage
			.from('avatars')
			.upload(path, resized, { upsert: true });

		if (uploadError) {
			bannerError = uploadError.message;
			bannerPreview = null;
			bannerUploading = false;
			return;
		}

		const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
		const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

		const { error: updateError } = await supabase
			.from('profiles')
			.update({ banner_url: publicUrl })
			.eq('id', data.user.id);

		if (updateError) {
			bannerError = updateError.message;
		}

		await invalidateAll();
		bannerUploading = false;
	}
</script>

<div class="profile-page">

	<div class="page-title-row">
		<div>
			<p class="page-eyebrow">Settings</p>
			<h1 class="page-title">Your Profile</h1>
		</div>
		<a href="/profile/{data.user.id}" class="btn btn-outline view-profile-btn">
			View Public Profile
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>
		</a>
	</div>

	<!-- Profile Info -->
	<div class="card">
		<form method="POST" action="?/updateProfile" use:enhance={() => ({ update }) => update({ reset: false })}>
			<div class="banner-section">
				<div class="banner-wrap" class:uploading={bannerUploading}>
					{#if bannerUploading}
						<div class="banner-placeholder">
							<svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
								<path d="M12 2a10 10 0 0 1 10 10" />
							</svg>
						</div>
					{:else if bannerPreview || data.profile?.banner_url}
						<img src={bannerPreview ?? data.profile?.banner_url ?? ''} alt="Banner" class="banner-img" />
					{:else}
						<div class="banner-placeholder">
							<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>
							</svg>
							<span>Add a banner image</span>
						</div>
					{/if}
					{#if !bannerUploading}
						<label class="banner-cam" title="Change banner">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
								<circle cx="12" cy="13" r="4" />
							</svg>
							<input type="file" accept="image/*" class="sr-only" onchange={handleBannerChange} />
						</label>
					{/if}
				</div>
				{#if bannerError}
					<p class="avatar-error">{bannerError}</p>
				{/if}
			</div>

			<div class="avatar-section">
				<div class="avatar-wrap" class:uploading={avatarUploading}>
					{#if avatarUploading}
						<div class="avatar-circle">
							<svg class="spinner" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
								<path d="M12 2a10 10 0 0 1 10 10" />
							</svg>
						</div>
					{:else if avatarPreview || data.profile?.avatar_url}
						<img src={avatarPreview ?? data.profile?.avatar_url ?? ''} alt="Profile" class="avatar-img" />
					{:else}
						<div class="avatar-circle">{getInitial()}</div>
					{/if}
					{#if !avatarUploading}
						<label class="avatar-cam" title="Change photo">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
								<circle cx="12" cy="13" r="4" />
							</svg>
							<input type="file" accept="image/*" class="sr-only" onchange={handleAvatarChange} />
						</label>
					{/if}
				</div>
				<div class="avatar-section-text">
					<h2 class="avatar-heading">Profile</h2>
					{#if avatarError}
						<p class="avatar-error">{avatarError}</p>
					{:else}
						<p class="avatar-hint">{avatarUploading ? 'Uploading…' : 'Click the camera to change your photo'}</p>
					{/if}
				</div>
			</div>

			{#if form?.updateError}
				<p class="error-banner" role="alert">{form.updateError}</p>
			{/if}
			{#if form?.updated}
				<p class="success-msg">Profile saved!</p>
			{/if}

			<div class="form-grid">
				<div class="form-field">
					<label for="full_name">Display Name</label>
					<div class="field">
						<input id="full_name" name="full_name" type="text" placeholder="Your name" value={data.profile?.full_name ?? ''} />
					</div>
				</div>

				<div class="form-field">
					<span id="type-label">Profile Type</span>
					<div class="segmented" role="radiogroup" aria-labelledby="type-label">
						<label class="segment" class:selected={profileType === 'artist'}>
							<input type="radio" name="profile_type" value="artist" bind:group={profileType} />
							Artist
						</label>
						<label class="segment" class:selected={profileType === 'venue'}>
							<input type="radio" name="profile_type" value="venue" bind:group={profileType} />
							Venue
						</label>
					</div>
				</div>

				<div class="form-field full band-field">
					<div class="band-toggle-text">
						<span class="band-toggle-label" id="band-label">Band or collective</span>
						<span class="band-toggle-desc">Turn this on if this account represents a band rather than just you. Other artists can then request to join.</span>
					</div>
					<label class="toggle-wrap" aria-labelledby="band-label">
						<input type="checkbox" name="is_band" checked={!!(data.profile as any)?.is_band} />
						<span class="toggle-track">
							<span class="toggle-thumb"></span>
						</span>
					</label>
				</div>

				<div class="form-field">
					<label for="location">General Area</label>
					<LocationSearch
						value={data.profile?.location ?? ''}
						lat={data.profile?.location_lat ?? null}
						lng={data.profile?.location_lng ?? null}
					/>
				</div>

				<div class="form-field full">
					<label for="bio">Bio</label>
					<div class="field">
						<textarea id="bio" name="bio" rows={4} placeholder="Tell the community about yourself, your sound, what you're looking for…">{data.profile?.bio ?? ''}</textarea>
					</div>
				</div>

				<div class="form-field full">
					<span id="tags-label">Tags</span>
					<TagInput tags={profileTags} ontags={(t) => (profileTags = t)} placeholder="Add genre, instrument, style… (Enter or comma)" />
					<input type="hidden" name="tags" value={JSON.stringify(profileTags)} />
				</div>

				{#if profileType === 'artist'}
					<div class="form-field full">
						<span id="roles-label">Artist Roles</span>
						<div class="role-chips" role="group" aria-labelledby="roles-label">
							{#each ARTIST_ROLES as role}
								<button
									type="button"
									class="role-chip"
									class:role-chip-active={artistRoles.includes(role)}
									onclick={() => toggleRole(role)}
								>{role}</button>
							{/each}
						</div>
						<input type="hidden" name="artist_roles" value={JSON.stringify(artistRoles)} />
					</div>
				{/if}
			</div>

			<div class="subsection">
				<h3 class="subsection-title">Contact Information</h3>
				<p class="subsection-desc">Visible on your public profile.</p>
			</div>

			<div class="form-grid">
				<div class="form-field">
					<label for="contact_email">Public Email</label>
					<div class="field">
						<input id="contact_email" name="contact_email" type="email" placeholder="booking@example.com" value={data.profile?.contact_email ?? ''} />
					</div>
				</div>

				<div class="form-field">
					<label for="instagram">Instagram</label>
					<div class="field">
						<span class="input-prefix">@</span>
						<input id="instagram" name="instagram" type="text" placeholder="yourhandle" value={data.profile?.instagram ?? ''} />
					</div>
				</div>
			</div>

			<div class="form-footer">
				<button type="submit" class="btn btn-primary save-btn">Save Changes</button>
			</div>
		</form>
	</div>

	<!-- Posts -->
	<div class="card">
		<div class="section-header">
			<h2 class="card-title">Posts</h2>
			<a href="/post/new" class="new-post-btn">+ New Post</a>
		</div>

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
				<p class="empty-sub">Share your music, upcoming shows, or anything with the community.</p>
				<a href="/post/new" class="empty-cta">Create your first post</a>
			</div>
		{/if}
	</div>

	<!-- Events Calendar -->
	<div class="card">
		<div class="section-header">
			<h2 class="card-title">Events Calendar</h2>
			<button type="button" class="new-post-btn" onclick={openAddEvent}>+ Add Event</button>
		</div>

		<div class="cal-header-nav">
			<button class="cal-nav-btn" onclick={prevMonth} aria-label="Previous month">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
			</button>
			<span class="cal-month-label">{monthLabel}</span>
			<button class="cal-nav-btn" onclick={nextMonth} aria-label="Next month">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
			</button>
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
				<div class="day-panel-header">
					<h3 class="day-panel-title">{formatSelectedDay(selectedDay)}</h3>
					<button type="button" class="add-day-event-btn" onclick={openAddEvent}>+ Add</button>
				</div>
				{#each (eventsByDate.get(selectedDay) ?? []) as ev (ev.id)}
					<div class="event-item-editor">
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
						</div>
						<div class="event-actions">
							<button type="button" class="edit-event-btn" onclick={() => openEditEvent(ev)}>Edit</button>
							<form method="POST" action="?/deleteEvent" use:enhance>
								<input type="hidden" name="event_id" value={ev.id} />
								<button type="submit" class="del-event-btn">Delete</button>
							</form>
						</div>
					</div>
				{/each}
				{#if !(eventsByDate.get(selectedDay)?.length)}
					<p class="no-events-msg">No events on this day. <button type="button" class="inline-link-btn" onclick={openAddEvent}>Add one</button></p>
				{/if}
			</div>
		{:else}
			<p class="cal-hint">Click a day to view or manage events.</p>
		{/if}
	</div>

	<!-- Account Settings -->
	<div class="card">
		<h2 class="card-title">Account Settings</h2>

		<div class="setting-row">
			<div class="setting-info">
				<p class="setting-label">Profile Visibility</p>
				<p class="setting-desc">
					{data.profile?.discoverable ?? true
						? 'Your profile is visible to other artists and venues.'
						: 'Your profile is hidden from search results.'}
				</p>
			</div>
			<form method="POST" action="?/toggleDiscoverable" use:enhance>
				<label class="toggle-wrap">
					<input
						type="checkbox"
						name="discoverable"
						checked={data.profile?.discoverable ?? true}
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
					/>
					<span class="toggle-track">
						<span class="toggle-thumb"></span>
					</span>
				</label>
			</form>
		</div>

		<h3 class="notif-prefs-title">Notifications</h3>
		<p class="setting-desc notif-prefs-desc">
			Every notification can go out by email, show up in-app, both, or neither — toggle each independently.
		</p>
		<form method="POST" action="?/updateNotificationPreferences" use:enhance>
			<div class="notif-pref-grid">
				<div class="notif-pref-header">
					<span></span>
					<span>Email</span>
					<span>In-app</span>
				</div>
				{#each [
					{ key: 'new_follower', label: 'New followers' },
					{ key: 'nearby_event', label: 'Events near you' },
					{ key: 'new_comment', label: 'Comments on your posts' },
					{ key: 'band_join_request', label: 'Band join requests' },
					{ key: 'band_join_accepted', label: 'Band request accepted' }
				] as pref}
					{@const prefs = (data.profile as any)?.notification_preferences ?? {}}
					{@const current = prefs[pref.key] ?? { email: true, in_app: true }}
					<div class="notif-pref-row">
						<span class="notif-pref-label">{pref.label}</span>
						<label class="toggle-wrap toggle-sm">
							<input
								type="checkbox"
								name="{pref.key}_email"
								checked={current.email ?? true}
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							/>
							<span class="toggle-track">
								<span class="toggle-thumb"></span>
							</span>
						</label>
						<label class="toggle-wrap toggle-sm">
							<input
								type="checkbox"
								name="{pref.key}_in_app"
								checked={current.in_app ?? true}
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							/>
							<span class="toggle-track">
								<span class="toggle-thumb"></span>
							</span>
						</label>
					</div>
				{/each}
			</div>
		</form>

		<div class="danger-zone">
			<h3 class="danger-title">Danger Zone</h3>
			<p class="danger-desc">Permanently delete your account and all data. This cannot be undone.</p>

			{#if form?.deleteError}
				<p class="error-banner" role="alert">{form.deleteError}</p>
			{/if}

			{#if !confirmDelete}
				<button class="btn btn-danger delete-btn" onclick={() => (confirmDelete = true)}>
					Delete Account
				</button>
			{:else}
				<div class="delete-confirm">
					<p class="confirm-msg">Are you absolutely sure? All your posts, profile data, and account access will be gone.</p>
					<div class="confirm-actions">
						<form method="POST" action="?/deleteAccount" use:enhance>
							<button type="submit" class="btn btn-danger delete-btn">Yes, permanently delete</button>
						</form>
						<button class="cancel-btn" onclick={() => (confirmDelete = false)}>Cancel</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

</div>

{#if eventModal !== null}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="event-modal-backdrop"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(e) => { if (e.key === 'Escape') eventModal = null; }}
		onclick={(e) => { if (e.target === e.currentTarget) eventModal = null; }}
	>
		<div class="event-modal">
			<h3 class="event-modal-title">{eventModal.editing ? 'Edit Event' : 'Add Event'}</h3>
			{#if (form as any)?.eventError}
				<p class="error-banner" role="alert">{(form as any).eventError}</p>
			{/if}
			<form
				method="POST"
				action={eventModal.editing ? '?/updateEvent' : '?/createEvent'}
				use:enhance
			>
				{#if eventModal.editing}
					<input type="hidden" name="event_id" value={eventModal.editing.id} />
				{/if}
				<div class="event-form-grid">
					<div class="form-field full">
						<label for="ev-title">Title</label>
						<div class="field">
							<input id="ev-title" name="title" required placeholder="Event name" value={eventModal.editing?.title ?? ''} />
						</div>
					</div>
					<div class="form-field">
						<label for="ev-date">Date</label>
						<div class="field">
							<input id="ev-date" name="date" type="date" required value={eventModal.editing?.date ?? eventModal.prefillDate ?? ''} />
						</div>
					</div>
					<div class="form-field">
						<!-- spacer -->
					</div>
					<div class="form-field">
						<label for="ev-start">Start Time</label>
						<div class="field">
							<input id="ev-start" name="start_time" type="time" value={eventModal.editing?.start_time ?? ''} />
						</div>
					</div>
					<div class="form-field">
						<label for="ev-end">End Time</label>
						<div class="field">
							<input id="ev-end" name="end_time" type="time" value={eventModal.editing?.end_time ?? ''} />
						</div>
					</div>
					<div class="form-field full">
						<label for="ev-desc">Description</label>
						<div class="field">
							<textarea id="ev-desc" name="description" rows={3} placeholder="Optional details…">{eventModal.editing?.description ?? ''}</textarea>
						</div>
					</div>
				</div>
				<div class="event-modal-actions">
					<button type="button" class="cancel-btn" onclick={() => eventModal = null}>Cancel</button>
					<button type="submit" class="btn btn-primary save-btn">{eventModal.editing ? 'Save Changes' : 'Add Event'}</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.profile-page {
		max-width: 860px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.page-title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px;
	}

	.page-eyebrow {
		margin: 0 0 10px;
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-primary-bright);
	}

	.page-title {
		margin: 0;
		font-size: clamp(2.25rem, 6vw, 3.5rem);
		line-height: 0.98;
		letter-spacing: -0.035em;
	}

	.view-profile-btn {
		min-height: 48px;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card-lg);
		padding: 36px 40px;
		box-shadow: var(--shadow-sm);
	}

	.card-title {
		font-size: 1.625rem;
		margin: 0 0 20px;
	}

	.notif-prefs-title {
		font-size: 1rem;
		font-weight: 700;
		margin: 24px 0 2px;
	}

	.notif-prefs-desc {
		margin-bottom: 10px;
	}

	.notif-pref-grid {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.notif-pref-header,
	.notif-pref-row {
		display: grid;
		grid-template-columns: 1fr 64px 64px;
		align-items: center;
		gap: 8px;
		padding: 10px 4px;
	}

	.notif-pref-header {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.notif-pref-header span:not(:first-child),
	.notif-pref-row .toggle-wrap {
		justify-self: center;
	}

	.notif-pref-row {
		border-top: 1px solid var(--color-border);
	}

	.notif-pref-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.toggle-sm {
		width: 38px;
		height: 21px;
	}

	.toggle-sm .toggle-thumb {
		width: 15px;
		height: 15px;
		top: 3px;
		left: 3px;
	}

	.toggle-sm input:checked + .toggle-track .toggle-thumb {
		transform: translateX(17px);
	}

	/* Banner */
	.banner-section {
		margin: -36px -40px 28px;
	}

	.banner-wrap {
		position: relative;
		height: 200px;
		border-radius: var(--radius-card-lg) var(--radius-card-lg) 0 0;
		overflow: hidden;
		background: var(--color-ink);
	}

	.banner-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.banner-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--color-lilac-soft);
		background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
		background-size: 26px 26px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.banner-wrap.uploading .banner-placeholder {
		opacity: 0.6;
	}

	.banner-cam {
		position: absolute;
		right: 16px;
		bottom: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--color-ink);
		color: var(--color-cream);
		border: 3px solid var(--color-surface);
		cursor: pointer;
		box-shadow: 0 6px 16px rgba(23, 8, 47, 0.35);
	}

	.banner-section .avatar-error {
		margin: 10px 40px 0;
		max-width: none;
	}

	/* Avatar */
	.avatar-section {
		display: flex;
		align-items: center;
		gap: 24px;
		margin-bottom: 28px;
	}

	.avatar-wrap {
		position: relative;
		flex-shrink: 0;
		width: 112px;
		height: 112px;
	}

	.avatar-circle {
		width: 112px;
		height: 112px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		font-family: var(--font-display);
		font-size: 2.75rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar-cam {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--color-ink);
		color: var(--color-cream);
		border: 4px solid var(--color-surface);
		cursor: pointer;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.avatar-section-text {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.avatar-heading {
		margin: 0;
		font-size: 1.625rem;
	}

	.avatar-hint {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	/* Form */
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-bottom: 8px;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-field.full {
		grid-column: 1 / -1;
	}

	label,
	#tags-label,
	#roles-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-strong);
	}

	.field textarea {
		resize: vertical;
		line-height: 1.5;
		min-height: 90px;
	}

	.input-prefix {
		color: var(--color-text-muted);
		font-size: 0.95rem;
		flex-shrink: 0;
	}

	.subsection {
		margin: 24px 0 16px;
	}

	.subsection-title {
		font-size: 0.95rem;
		font-weight: 600;
	}

	.subsection-desc {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		margin-top: 2px;
	}

	.form-footer {
		display: flex;
		justify-content: flex-end;
		margin-top: 24px;
	}

	.success-msg {
		background: #f0fdf4;
		color: #16a34a;
		border: 1px solid #bbf7d0;
		border-radius: var(--radius-md);
		padding: 10px 14px;
		font-size: 0.875rem;
		margin-bottom: 16px;
	}

	/* Posts */
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24px;
	}

	.section-header .card-title {
		margin-bottom: 0;
	}

	.new-post-btn {
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		text-decoration: none;
		background: var(--color-primary-light);
		color: var(--color-primary-deep);
		border: 1.5px solid var(--color-primary-light);
		border-radius: var(--radius-pill);
		padding: 0 16px;
		font-size: 0.875rem;
		font-weight: 700;
		transition: background 0.15s, border-color 0.15s;
		cursor: pointer;
	}

	.new-post-btn:hover {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.posts-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
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

	.empty-cta {
		margin-top: 8px;
		display: inline-block;
		text-decoration: none;
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 8px 20px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		transition: border-color 0.15s, color 0.15s;
	}

	.empty-cta:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	/* Settings */
	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding-bottom: 24px;
		border-bottom: 1px solid var(--color-border);
		margin-bottom: 24px;
	}

	.setting-label {
		font-size: 0.9rem;
		font-weight: 600;
	}

	.setting-desc {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		margin-top: 2px;
	}

	/* Toggle switch */
	.toggle-wrap {
		position: relative;
		display: inline-flex;
		width: 48px;
		height: 26px;
		flex-shrink: 0;
		cursor: pointer;
	}

	.toggle-wrap input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-track {
		position: absolute;
		inset: 0;
		background: var(--color-border);
		border-radius: 13px;
		transition: background 0.2s;
	}

	.toggle-wrap input:checked + .toggle-track {
		background: var(--color-primary-bright);
	}

	.toggle-thumb {
		position: absolute;
		width: 20px;
		height: 20px;
		background: white;
		border-radius: 50%;
		top: 3px;
		left: 3px;
		transition: transform 0.2s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}

	.toggle-wrap input:checked + .toggle-track .toggle-thumb {
		transform: translateX(22px);
	}

	/* Danger zone */
	.danger-zone {
		background: var(--color-danger-bg);
		border: 1px solid var(--color-danger-border);
		border-radius: var(--radius-md);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.danger-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--color-danger);
	}

	.danger-desc {
		font-size: 0.82rem;
		color: var(--color-danger);
	}

	.delete-btn {
		align-self: flex-start;
	}

	.delete-confirm {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.confirm-msg {
		font-size: 0.875rem;
		color: var(--color-danger);
		line-height: 1.5;
	}

	.confirm-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.cancel-btn {
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-pill);
		min-height: 44px;
		padding: 0 20px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		transition: border-color 0.15s, color 0.15s;
	}

	.cancel-btn:hover {
		border-color: var(--color-text);
		color: var(--color-text);
	}

	.avatar-img {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-wrap.uploading .avatar-circle {
		opacity: 0.6;
	}

	.spinner {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.avatar-error {
		font-size: 0.8rem;
		color: #dc2626;
		text-align: center;
		max-width: 260px;
	}

	.band-field {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 14px 16px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-input);
		background: var(--color-surface-tint);
	}

	.band-toggle-text {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.band-toggle-label {
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--color-text-strong);
	}

	.band-toggle-desc {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.45;
	}

	.segmented {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding: 5px;
		height: 54px;
		box-sizing: border-box;
		border-radius: var(--radius-input);
		background: var(--color-surface-tint);
		border: 1.5px solid var(--color-border);
	}

	.segment {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 11px;
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--color-text-strong);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.segment input {
		position: absolute;
		opacity: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		cursor: pointer;
	}

	.segment.selected {
		background: var(--color-ink);
		color: var(--color-cream);
	}

	.role-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.role-chip {
		min-height: 36px;
		padding: 0 16px;
		border-radius: var(--radius-pill);
		border: 1.5px solid var(--color-border);
		background: var(--color-surface-tint);
		color: var(--color-text-muted);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s, color 0.15s;
		font-family: inherit;
	}

	.role-chip:hover {
		border-color: var(--color-lilac);
		color: var(--color-primary-deep);
		background: var(--color-primary-light);
	}

	.role-chip-active {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-cream);
	}

	.role-chip-active:hover {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-cream);
	}

	/* Calendar */
	.cal-header-nav {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-bottom: 16px;
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
		gap: 10px;
	}
	.day-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.day-panel-title {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}
	.add-day-event-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		padding: 4px 12px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--color-text-muted);
		font-family: inherit;
		transition: background 0.15s, color 0.15s, border-color 0.15s;
	}
	.add-day-event-btn:hover {
		background: var(--color-primary-light);
		color: var(--color-primary-deep);
		border-color: var(--color-lilac);
	}
	.event-item-editor {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		padding: 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
	}
	.event-time-badge {
		font-size: 0.78rem;
		color: var(--color-primary-deep);
		font-weight: 600;
		white-space: nowrap;
		padding-top: 2px;
		min-width: 90px;
	}
	.event-info {
		flex: 1;
		min-width: 0;
	}
	.event-info .event-title {
		font-size: 0.9rem;
		font-weight: 600;
		margin: 0;
	}
	.event-info .event-desc {
		font-size: 0.825rem;
		color: var(--color-text-muted);
		margin: 4px 0 0;
		line-height: 1.5;
	}
	.event-actions {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-shrink: 0;
	}
	.edit-event-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		padding: 4px 12px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--color-text-muted);
		font-family: inherit;
		transition: background 0.15s;
	}
	.edit-event-btn:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}
	.del-event-btn {
		background: none;
		border: 1px solid var(--color-danger-border);
		border-radius: var(--radius-pill);
		padding: 4px 12px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--color-danger);
		font-family: inherit;
		transition: background 0.15s;
	}
	.del-event-btn:hover {
		background: var(--color-danger-bg);
	}
	.no-events-msg {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-align: center;
		padding: 16px 0;
		margin: 0;
	}
	.inline-link-btn {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--color-primary-dark);
		cursor: pointer;
		text-decoration: underline;
	}
	.cal-hint {
		font-size: 0.825rem;
		color: var(--color-text-muted);
		text-align: center;
		border-top: 1px solid var(--color-border);
		padding-top: 14px;
		margin: 0;
	}

	/* Event modal */
	.event-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.event-modal {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-card-hover);
		width: 460px;
		max-width: calc(100vw - 32px);
		padding: 28px;
	}
	.event-modal-title {
		font-size: 1.05rem;
		margin: 0 0 20px;
	}
	.event-form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}
	.event-form-grid .form-field.full {
		grid-column: 1 / -1;
	}
	.event-modal-actions {
		display: flex;
		gap: 10px;
		margin-top: 20px;
		justify-content: flex-end;
	}
</style>
