<script lang="ts">
	import { goto } from '$app/navigation';
	import PostCard from '$lib/components/PostCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const profile = $derived(data.profile);

	let userFollows = $state(data.userFollows);
	let followerCount = $state(data.followerCount);
	let toggling = $state(false);
	let followBtnHovered = $state(false);

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
</script>

<div class="public-profile">

	<div class="card">
		<div class="profile-header">
			<div class="avatar-wrap">
				{#if profile.avatar_url}
					<img src={profile.avatar_url} alt={profile.full_name ?? 'Profile'} class="avatar-img" />
				{:else}
					<div class="avatar-circle">{getInitial()}</div>
				{/if}
			</div>

			<div class="header-info">
				<div class="name-row">
					<h1 class="display-name">{profile.full_name ?? 'Anonymous Artist'}</h1>
					<div class="follow-stats">
						<span class="stat"><strong>{followerCount}</strong> Followers</span>
						<span class="stat-dot">·</span>
						<span class="stat"><strong>{data.followingCount}</strong> Following</span>
					</div>
				</div>
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

			{#if !data.isOwnProfile}
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
			{/if}
		</div>

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

		{#if profile.bio}
			<div class="section">
				<h2 class="section-title">About</h2>
				<p class="bio">{profile.bio}</p>
			</div>
		{/if}

		{#if profile.contact_email || profile.instagram}
			<div class="section">
				<h2 class="section-title">Contact</h2>
				<div class="contact-list">
					{#if profile.contact_email}
						<a href="mailto:{profile.contact_email}" class="contact-item">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect width="20" height="16" x="2" y="4" rx="2" />
								<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
							</svg>
							{profile.contact_email}
						</a>
					{/if}
					{#if profile.instagram}
						<a href="https://instagram.com/{profile.instagram}" target="_blank" rel="noopener noreferrer" class="contact-item">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
								<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
								<line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
							</svg>
							@{profile.instagram}
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<div class="card">
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
	</div>

</div>

<style>
	.public-profile {
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

	/* Header */
	.profile-header {
		display: flex;
		align-items: center;
		gap: 20px;
		margin-bottom: 20px;
	}

	.avatar-wrap {
		flex-shrink: 0;
	}

	.avatar-img {
		width: 88px;
		height: 88px;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-circle {
		width: 88px;
		height: 88px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		font-size: 2rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.header-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.name-row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 10px;
	}

	.display-name {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.4px;
		margin: 0;
		flex-shrink: 0;
	}

	.follow-stats {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.stat {
		font-size: 0.82rem;
		color: var(--color-text-muted);
	}

	.stat strong {
		color: var(--color-text);
		font-weight: 600;
	}

	.stat-dot {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.location {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Follow button */
	.follow-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		padding: 9px 22px;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
		background: var(--color-primary);
		color: white;
		border: 1.5px solid var(--color-primary);
	}

	.follow-btn:hover:not(.is-following):not(:disabled) {
		background: var(--color-primary-dark);
		border-color: var(--color-primary-dark);
	}

	.follow-btn.is-following {
		background: none;
		color: var(--color-text);
		border-color: var(--color-border);
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
		gap: 10px;
		padding: 12px 16px;
		background: var(--color-bg);
		border-radius: var(--radius-md);
		margin-bottom: 20px;
	}

	.mutual-avatars {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.mutual-avatar {
		width: 24px;
		height: 24px;
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
		background: var(--color-primary);
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

	/* Sections */
	.section {
		padding-top: 24px;
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.section + .section {
		margin-top: 0;
	}

	.section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.bio {
		font-size: 0.9rem;
		line-height: 1.65;
		color: var(--color-text);
		white-space: pre-wrap;
		margin: 0;
	}

	/* Contact */
	.contact-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.contact-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.875rem;
		color: var(--color-primary);
		text-decoration: none;
		width: fit-content;
	}

	.contact-item:hover {
		text-decoration: underline;
	}

	/* Posts */
	.posts-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.card-title {
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.3px;
		margin-bottom: 24px;
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
</style>
