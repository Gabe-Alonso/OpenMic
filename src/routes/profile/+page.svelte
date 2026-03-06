<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { createClient } from '$lib/supabase';
	import LocationSearch from '$lib/components/LocationSearch.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const supabase = createClient();
	const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

	let confirmDelete = $state(false);
	let avatarPreview = $state<string | null>(null);
	let avatarUploading = $state(false);
	let avatarError = $state<string | null>(null);

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
		avatarPreview = URL.createObjectURL(file);

		const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
		const path = `${data.user.id}/avatar.${ext}`;

		const { error: uploadError } = await supabase.storage
			.from('avatars')
			.upload(path, file, { upsert: true });

		if (uploadError) {
			avatarError = uploadError.message;
			avatarPreview = null;
			avatarUploading = false;
			return;
		}

		const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);

		const { error: updateError } = await supabase
			.from('profiles')
			.update({ avatar_url: urlData.publicUrl })
			.eq('id', data.user.id);

		if (updateError) {
			avatarError = updateError.message;
		}

		await invalidateAll();
		avatarUploading = false;
	}
</script>

<div class="profile-page">

	<!-- Profile Info -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Your Profile</h2>
			<a href="/profile/{data.user.id}" class="view-profile-btn">View Public Profile</a>
		</div>

		<form method="POST" action="?/updateProfile" use:enhance={() => ({ update }) => update({ reset: false })}>
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
						<label class="avatar-overlay" title="Change photo">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
								<circle cx="12" cy="13" r="4" />
							</svg>
							<input type="file" accept="image/*" class="sr-only" onchange={handleAvatarChange} />
						</label>
					{/if}
				</div>
				{#if avatarError}
					<p class="avatar-error">{avatarError}</p>
				{:else}
					<p class="avatar-hint">{avatarUploading ? 'Uploading…' : 'Click to change photo'}</p>
				{/if}
			</div>

			{#if form?.updateError}
				<p class="error-msg">{form.updateError}</p>
			{/if}
			{#if form?.updated}
				<p class="success-msg">Profile saved!</p>
			{/if}

			<div class="form-grid">
				<div class="field">
					<label for="full_name">Display Name</label>
					<input id="full_name" name="full_name" type="text" placeholder="Your name" value={data.profile?.full_name ?? ''} />
				</div>

				<div class="field">
					<label for="location">General Area</label>
					<LocationSearch
						value={data.profile?.location ?? ''}
						lat={data.profile?.location_lat ?? null}
						lng={data.profile?.location_lng ?? null}
					/>
				</div>

				<div class="field full">
					<label for="bio">Bio</label>
					<textarea id="bio" name="bio" rows={4} placeholder="Tell the community about yourself, your sound, what you're looking for…">{data.profile?.bio ?? ''}</textarea>
				</div>
			</div>

			<div class="subsection">
				<h3 class="subsection-title">Contact Information</h3>
				<p class="subsection-desc">Visible on your public profile.</p>
			</div>

			<div class="form-grid">
				<div class="field">
					<label for="contact_email">Public Email</label>
					<input id="contact_email" name="contact_email" type="email" placeholder="booking@example.com" value={data.profile?.contact_email ?? ''} />
				</div>

				<div class="field">
					<label for="instagram">Instagram</label>
					<div class="input-prefix-wrap">
						<span class="input-prefix">@</span>
						<input id="instagram" name="instagram" type="text" placeholder="yourhandle" value={data.profile?.instagram ?? ''} class="with-prefix" />
					</div>
				</div>
			</div>

			<div class="form-footer">
				<button type="submit" class="save-btn">Save Changes</button>
			</div>
		</form>
	</div>

	<!-- Posts -->
	<div class="card">
		<div class="section-header">
			<h2 class="card-title">Posts</h2>
			<button class="new-post-btn">+ New Post</button>
		</div>

		<div class="empty-state">
			<span class="empty-icon">🎵</span>
			<p class="empty-title">Nothing here yet</p>
			<p class="empty-sub">Share your music, upcoming shows, or anything with the community.</p>
			<button class="empty-cta">Create your first post</button>
		</div>
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

		<div class="danger-zone">
			<h3 class="danger-title">Danger Zone</h3>
			<p class="danger-desc">Permanently delete your account and all data. This cannot be undone.</p>

			{#if form?.deleteError}
				<p class="error-msg">{form.deleteError}</p>
			{/if}

			{#if !confirmDelete}
				<button class="delete-btn" onclick={() => (confirmDelete = true)}>
					Delete Account
				</button>
			{:else}
				<div class="delete-confirm">
					<p class="confirm-msg">Are you absolutely sure? All your posts, profile data, and account access will be gone.</p>
					<div class="confirm-actions">
						<form method="POST" action="?/deleteAccount" use:enhance>
							<button type="submit" class="delete-btn">Yes, permanently delete</button>
						</form>
						<button class="cancel-btn" onclick={() => (confirmDelete = false)}>Cancel</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

</div>

<style>
	.profile-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 32px;
		box-shadow: var(--shadow-sm);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24px;
	}

	.card-header .card-title {
		margin-bottom: 0;
	}

	.view-profile-btn {
		font-size: 0.825rem;
		font-weight: 500;
		color: var(--color-primary);
		text-decoration: none;
		padding: 6px 12px;
		border: 1.5px solid var(--color-primary-light);
		border-radius: var(--radius-sm);
		background: var(--color-primary-light);
		transition: background 0.15s, border-color 0.15s;
	}

	.view-profile-btn:hover {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.card-title {
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.3px;
		margin-bottom: 24px;
	}

	/* Avatar */
	.avatar-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		margin-bottom: 28px;
	}

	.avatar-wrap {
		position: relative;
		width: 96px;
		height: 96px;
	}

	.avatar-circle {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		font-size: 2rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar-overlay {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.45);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.15s;
		cursor: pointer;
	}

	.avatar-wrap:hover .avatar-overlay {
		opacity: 1;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.avatar-hint {
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	/* Form */
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-bottom: 8px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field.full {
		grid-column: 1 / -1;
	}

	label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	input,
	textarea {
		width: 100%;
		padding: 10px 14px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		background: var(--color-bg);
		color: var(--color-text);
		transition: border-color 0.15s;
		outline: none;
		font-family: inherit;
	}

	input:focus,
	textarea:focus {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	input::placeholder,
	textarea::placeholder {
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.input-prefix-wrap {
		display: flex;
	}

	.input-prefix {
		display: flex;
		align-items: center;
		padding: 10px 12px;
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		border-right: none;
		border-radius: var(--radius-sm) 0 0 var(--radius-sm);
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.with-prefix {
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
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

	.save-btn {
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 10px 24px;
		font-size: 0.9rem;
		font-weight: 600;
		transition: background 0.15s;
	}

	.save-btn:hover {
		background: var(--color-primary-dark);
	}

	.success-msg {
		background: #f0fdf4;
		color: #16a34a;
		border: 1px solid #bbf7d0;
		border-radius: var(--radius-sm);
		padding: 10px 14px;
		font-size: 0.875rem;
		margin-bottom: 16px;
	}

	.error-msg {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
		border-radius: var(--radius-sm);
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
		background: var(--color-primary-light);
		color: var(--color-primary);
		border: 1.5px solid var(--color-primary-light);
		border-radius: var(--radius-sm);
		padding: 8px 16px;
		font-size: 0.875rem;
		font-weight: 600;
		transition: background 0.15s, border-color 0.15s;
	}

	.new-post-btn:hover {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
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
		font-size: 1rem;
		font-weight: 600;
	}

	.empty-sub {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		max-width: 340px;
		line-height: 1.5;
	}

	.empty-cta {
		margin-top: 8px;
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
		background: var(--color-primary);
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
		background: #fff8f8;
		border: 1px solid #fecaca;
		border-radius: var(--radius-md);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.danger-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: #dc2626;
	}

	.danger-desc {
		font-size: 0.82rem;
		color: #7f1d1d;
	}

	.delete-btn {
		background: #dc2626;
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 9px 20px;
		font-size: 0.875rem;
		font-weight: 600;
		transition: background 0.15s;
		align-self: flex-start;
	}

	.delete-btn:hover {
		background: #b91c1c;
	}

	.delete-confirm {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.confirm-msg {
		font-size: 0.875rem;
		color: #7f1d1d;
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
		border-radius: var(--radius-sm);
		padding: 8px 16px;
		font-size: 0.875rem;
		font-weight: 500;
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
</style>
