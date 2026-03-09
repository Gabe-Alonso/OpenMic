<script lang="ts">
	import { goto } from '$app/navigation';
	import PostCard from '$lib/components/PostCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tab = 'discover' | 'local' | 'following';
	let activeTab = $state<Tab>('discover');

	// --- Local tab ---
	const RADIUS_OPTIONS = [10, 25, 50, 100, 250];
	let localRadius = $state(50);
	let localLoading = $state(false);
	let localPosts = $state<any[] | null>(null);
	let localLikeCounts = $state<Record<string, number>>({});
	let localNoLocation = $state(false);

	// --- Following tab ---
	let followingLoading = $state(false);
	let followingPosts = $state<any[] | null>(null);
	let followingLikeCounts = $state<Record<string, number>>({});
	let includeFollowers = $state(false);

	async function loadLocal() {
		localLoading = true;
		const res = await fetch(`/api/community/local?radius=${localRadius}`);
		if (res.ok) {
			const json = await res.json();
			localNoLocation = json.noLocation ?? false;
			localPosts = json.posts ?? [];
			localLikeCounts = json.likeCounts ?? {};
		}
		localLoading = false;
	}

	async function loadFollowing() {
		followingLoading = true;
		const res = await fetch(`/api/community/following?include_followers=${includeFollowers}`);
		if (res.ok) {
			const json = await res.json();
			followingPosts = json.posts ?? [];
			followingLikeCounts = json.likeCounts ?? {};
		} else if (res.status === 401) {
			goto('/signin');
		}
		followingLoading = false;
	}

	function switchTab(tab: Tab) {
		activeTab = tab;
		if (tab === 'local' && data.isSignedIn && data.userHasLocation && localPosts === null && !localLoading) {
			loadLocal();
		}
		if (tab === 'following' && data.isSignedIn && followingPosts === null && !followingLoading) {
			loadFollowing();
		}
	}

	async function handleRadiusChange() {
		localPosts = null;
		await loadLocal();
	}

	async function handleToggleFollowers() {
		includeFollowers = !includeFollowers;
		await loadFollowing();
	}
</script>

<div class="community-page">
	<div class="page-header">
		<h1 class="page-title">Community</h1>
		<div class="tabs" role="tablist">
			<button
				role="tab"
				class="tab-btn"
				class:active={activeTab === 'discover'}
				onclick={() => switchTab('discover')}
			>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
				</svg>
				Discover
			</button>
			<button
				role="tab"
				class="tab-btn"
				class:active={activeTab === 'local'}
				onclick={() => switchTab('local')}
			>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
				</svg>
				Local
			</button>
			<button
				role="tab"
				class="tab-btn"
				class:active={activeTab === 'following'}
				onclick={() => switchTab('following')}
			>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
				</svg>
				Following
			</button>
		</div>
	</div>

	<!-- DISCOVER TAB -->
	{#if activeTab === 'discover'}
		<div class="tab-pane">
			<p class="tab-desc">Most engaged posts from across the platform.</p>
			{#if data.discoverPosts.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🎵</span>
					<p class="empty-title">No posts yet</p>
					<p class="empty-sub">Be the first to share something with the community.</p>
				</div>
			{:else}
				<div class="feed">
					{#each data.discoverPosts as post (post.id)}
						<PostCard {post} likeCount={data.likeCounts[post.id] ?? 0} showAuthor={true} />
					{/each}
				</div>
			{/if}
		</div>

	<!-- LOCAL TAB -->
	{:else if activeTab === 'local'}
		<div class="tab-pane">
			{#if !data.isSignedIn}
				<div class="auth-prompt">
					<p class="auth-prompt-text">Sign in to see posts from artists near you.</p>
					<a href="/signin" class="auth-btn">Sign In</a>
				</div>
			{:else if !data.userHasLocation}
				<div class="no-location-card">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="no-location-icon">
						<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
					</svg>
					<p class="no-location-title">No location set</p>
					<p class="no-location-sub">Add your location in your profile to discover local artists and their posts.</p>
					<a href="/profile" class="auth-btn">Go to Profile</a>
				</div>
			{:else}
				<div class="local-controls">
					<p class="tab-desc">Posts from artists within your area.</p>
					<div class="radius-row">
						<span class="radius-label">Radius:</span>
						<select class="radius-select" bind:value={localRadius} onchange={handleRadiusChange} disabled={localLoading}>
							{#each RADIUS_OPTIONS as r}
								<option value={r}>{r} mi</option>
							{/each}
						</select>
					</div>
				</div>

				{#if localLoading}
					<div class="loading-state">
						<svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
							<path d="M12 2a10 10 0 0 1 10 10" />
						</svg>
						Loading…
					</div>
				{:else if localPosts === null}
					<!-- not loaded yet (shouldn't show long) -->
				{:else if localPosts.length === 0}
					<div class="empty-state">
						<span class="empty-icon">🗺️</span>
						<p class="empty-title">No local posts</p>
						<p class="empty-sub">No artists in your area have posted yet. Try increasing the radius.</p>
					</div>
				{:else}
					<div class="feed">
						{#each localPosts as post (post.id)}
							<PostCard {post} likeCount={localLikeCounts[post.id] ?? 0} showAuthor={true} />
						{/each}
					</div>
				{/if}
			{/if}
		</div>

	<!-- FOLLOWING TAB -->
	{:else if activeTab === 'following'}
		<div class="tab-pane">
			{#if !data.isSignedIn}
				<div class="auth-prompt">
					<p class="auth-prompt-text">Sign in to see posts from people you follow.</p>
					<a href="/signin" class="auth-btn">Sign In</a>
				</div>
			{:else}
				<div class="following-controls">
					<p class="tab-desc">Posts from people you follow.</p>
					<label class="toggle-row">
						<div class="toggle-switch" class:on={includeFollowers} onclick={handleToggleFollowers} role="switch" aria-checked={includeFollowers} tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggleFollowers(); } }}>
							<div class="toggle-thumb"></div>
						</div>
						<span class="toggle-label">Also show followers you don't follow back</span>
					</label>
				</div>

				{#if followingLoading}
					<div class="loading-state">
						<svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
							<path d="M12 2a10 10 0 0 1 10 10" />
						</svg>
						Loading…
					</div>
				{:else if followingPosts === null}
					<!-- not yet loaded -->
				{:else if followingPosts.length === 0}
					<div class="empty-state">
						<span class="empty-icon">👥</span>
						<p class="empty-title">Nothing here yet</p>
						<p class="empty-sub">
							{#if includeFollowers}
								Neither you nor your followers have posted anything.
							{:else}
								Follow some artists to see their posts here.
							{/if}
						</p>
					</div>
				{:else}
					<div class="feed">
						{#each followingPosts as post (post.id)}
							<PostCard {post} likeCount={followingLikeCounts[post.id] ?? 0} showAuthor={true} />
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.community-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* Header */
	.page-header {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 20px 24px 0;
		box-shadow: var(--shadow-sm);
	}

	.page-title {
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: -0.4px;
		margin-bottom: 16px;
	}

	/* Tabs */
	.tabs {
		display: flex;
		border-top: 1px solid var(--color-border);
		margin: 0 -24px;
	}

	.tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 12px 16px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
		margin-bottom: -1px;
	}

	.tab-btn:hover {
		color: var(--color-text);
	}

	.tab-btn.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
		font-weight: 600;
	}

	/* Tab pane */
	.tab-pane {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.tab-desc {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Feed */
	.feed {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* Local controls */
	.local-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.radius-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.radius-label {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.radius-select {
		padding: 6px 10px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		background: var(--color-bg);
		color: var(--color-text);
		outline: none;
		font-family: inherit;
		cursor: pointer;
		transition: border-color 0.15s, opacity 0.15s;
	}

	.radius-select:focus {
		border-color: var(--color-primary);
	}

	.radius-select:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* Following controls */
	.following-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	/* Toggle switch */
	.toggle-row {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.toggle-switch {
		width: 36px;
		height: 20px;
		border-radius: 10px;
		background: var(--color-border);
		position: relative;
		transition: background 0.2s;
		cursor: pointer;
		flex-shrink: 0;
	}

	.toggle-switch.on {
		background: var(--color-primary);
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: left 0.2s;
	}

	.toggle-switch.on .toggle-thumb {
		left: 18px;
	}

	.toggle-label {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		font-weight: 500;
		cursor: pointer;
	}

	/* Loading */
	.loading-state {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 32px 0;
		justify-content: center;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.spin {
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* No location */
	.no-location-card,
	.auth-prompt {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 48px 32px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		text-align: center;
		box-shadow: var(--shadow-sm);
	}

	.no-location-icon {
		color: var(--color-text-muted);
		opacity: 0.6;
		margin-bottom: 4px;
	}

	.no-location-title,
	.auth-prompt-text {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
	}

	.no-location-sub {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		max-width: 320px;
		line-height: 1.5;
		margin: 0;
	}

	.auth-btn {
		margin-top: 8px;
		padding: 9px 24px;
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		transition: background 0.15s;
	}

	.auth-btn:hover {
		background: var(--color-primary-dark);
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 56px 20px;
		text-align: center;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}

	.empty-icon {
		font-size: 2rem;
		margin-bottom: 4px;
	}

	.empty-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
	}

	.empty-sub {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		max-width: 320px;
		line-height: 1.5;
		margin: 0;
	}
</style>
