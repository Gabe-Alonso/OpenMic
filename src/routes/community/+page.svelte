<script lang="ts">
	import { stripHtml, timeAgo } from '$lib/format';
	import { goto } from '$app/navigation';
	import PostCard from '$lib/components/PostCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tab = 'discover' | 'local' | 'following';
	let activeTab = $state<Tab>('discover');

	const TAB_DESC: Record<Tab, string> = {
		discover: 'Most engaged posts from across the platform.',
		local: 'Posts from artists within your area.',
		following: 'Posts from people you follow.'
	};

	// --- Local tab ---
	const RADIUS_OPTIONS = [10, 25, 50, 100, 250];
	let localRadius = $state(50);
	let localLoading = $state(false);
	let localPosts = $state<any[] | null>(null);
	let localLikeCounts = $state<Record<string, number>>({});

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

	const featuredPost = $derived(activeTab === 'discover' && data.discoverPosts.length > 0 ? data.discoverPosts[0] : null);
	const restPosts = $derived(activeTab === 'discover' ? data.discoverPosts.slice(1) : []);
</script>

<div class="community-page">
	<div class="page-header-row">
		<div class="page-heading">
			<div class="deco-ring-a" aria-hidden="true"></div>
			<div class="deco-ring-b" aria-hidden="true"></div>
			<span class="eyebrow">The feed</span>
			<h1>Community</h1>
			<p class="tab-desc">{TAB_DESC[activeTab]}</p>
		</div>
		<a href="/post/new" class="btn btn-primary new-post-btn">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
			</svg>
			New Post
		</a>
	</div>

	<div class="tabs-row">
		<div class="tab-group" role="tablist" aria-label="Feed">
			<button role="tab" aria-selected={activeTab === 'discover'} class="tab-btn" class:active={activeTab === 'discover'} onclick={() => switchTab('discover')}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
				Discover
			</button>
			<button role="tab" aria-selected={activeTab === 'local'} class="tab-btn" class:active={activeTab === 'local'} onclick={() => switchTab('local')}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
				Local
			</button>
			<button role="tab" aria-selected={activeTab === 'following'} class="tab-btn" class:active={activeTab === 'following'} onclick={() => switchTab('following')}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
				Following
			</button>
		</div>

		{#if activeTab === 'local' && data.isSignedIn && data.userHasLocation}
			<div class="radius-row">
				<label for="radius-select" class="radius-label">Radius</label>
				<select id="radius-select" class="radius-select" bind:value={localRadius} onchange={handleRadiusChange} disabled={localLoading}>
					{#each RADIUS_OPTIONS as r}
						<option value={r}>{r} mi</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if activeTab === 'following' && data.isSignedIn}
			<button class="follow-switch" onclick={handleToggleFollowers} role="switch" aria-checked={includeFollowers}>
				<span class="switch-track" class:on={includeFollowers}>
					<span class="switch-thumb"></span>
				</span>
				Include followers
			</button>
		{/if}
	</div>

	<!-- DISCOVER TAB -->
	{#if activeTab === 'discover'}
		{#if data.discoverPosts.length === 0}
			<div class="empty-state">
				<span class="empty-icon-chip">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
				</span>
				<h2 class="empty-title">No posts yet</h2>
				<p class="empty-sub">Be the first to share something with the community.</p>
				<a href="/post/new" class="btn btn-primary">New Post</a>
			</div>
		{:else}
			<div class="feed">
				{#if featuredPost}
					<a href="/post/{featuredPost.id}" class="featured-card">
						<div class="featured-text">
							<div class="featured-top">
								<div class="featured-author">
									<span class="featured-avatar">{(featuredPost.profiles?.full_name ?? '?')[0]?.toUpperCase()}</span>
									<span class="featured-name">{featuredPost.profiles?.full_name ?? 'Anonymous Artist'}</span>
								</div>
								<span class="top-post-badge">Top post</span>
							</div>
							{#if featuredPost.tags?.length}
								<div class="featured-tags">
									{#each featuredPost.tags.slice(0, 2) as tag}
										<span class="featured-tag">#{tag}</span>
									{/each}
								</div>
							{/if}
							<p class="featured-quote">{stripHtml(featuredPost.body) || (featuredPost.youtube_url ? 'YouTube video' : '')}</p>
							<div class="featured-footer">
								<span>{timeAgo(featuredPost.created_at)}</span>
								<span class="featured-likes">
									<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
									{data.likeCounts[featuredPost.id] ?? 0}
								</span>
							</div>
						</div>
						{#if featuredPost.post_media?.length}
							<div class="featured-thumbs" class:single={featuredPost.post_media.length === 1}>
								{#each featuredPost.post_media.slice(0, 2) as m}
									<img src={m.url} alt="" />
								{/each}
							</div>
						{/if}
					</a>
				{/if}
				{#each restPosts as post (post.id)}
					<PostCard {post} likeCount={data.likeCounts[post.id] ?? 0} showAuthor={true} />
				{/each}
			</div>
		{/if}

	<!-- LOCAL TAB -->
	{:else if activeTab === 'local'}
		{#if !data.isSignedIn}
			<div class="auth-prompt">
				<p class="auth-prompt-text">Sign in to see posts from artists near you.</p>
				<a href="/signin" class="auth-btn">Sign In</a>
			</div>
		{:else if !data.userHasLocation}
			<div class="no-location-card">
				<span class="empty-icon-chip">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
				</span>
				<h2 class="empty-title">No location set</h2>
				<p class="empty-sub">Add your location in your profile to discover local artists and their posts.</p>
				<a href="/profile" class="auth-btn">Go to Profile</a>
			</div>
		{:else if localLoading}
			<div class="loading-state">
				<svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"/></svg>
				Loading…
			</div>
		{:else if localPosts !== null && localPosts.length === 0}
			<div class="empty-state">
				<span class="empty-icon-chip">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
				</span>
				<h2 class="empty-title">No local posts</h2>
				<p class="empty-sub">No artists in your area have posted yet. Try increasing the radius.</p>
			</div>
		{:else if localPosts !== null}
			<div class="feed">
				{#each localPosts as post (post.id)}
					<PostCard {post} likeCount={localLikeCounts[post.id] ?? 0} showAuthor={true} />
				{/each}
			</div>
		{/if}

	<!-- FOLLOWING TAB -->
	{:else if activeTab === 'following'}
		{#if !data.isSignedIn}
			<div class="auth-prompt">
				<p class="auth-prompt-text">Sign in to see posts from people you follow.</p>
				<a href="/signin" class="auth-btn">Sign In</a>
			</div>
		{:else if followingLoading}
			<div class="loading-state">
				<svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"/></svg>
				Loading…
			</div>
		{:else if followingPosts !== null && followingPosts.length === 0}
			<div class="empty-state">
				<span class="empty-icon-chip">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
				</span>
				<h2 class="empty-title">Nothing here yet</h2>
				<p class="empty-sub">
					{includeFollowers ? "Neither you nor your followers have posted anything." : 'Follow some artists to see their posts here.'}
				</p>
			</div>
		{:else if followingPosts !== null}
			<div class="feed">
				{#each followingPosts as post (post.id)}
					<PostCard {post} likeCount={followingLikeCounts[post.id] ?? 0} showAuthor={true} />
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.community-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	/* Header */
	.page-header-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
	}

	.page-heading {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.deco-ring-a {
		position: absolute;
		right: 60px;
		top: -110px;
		width: 240px;
		height: 240px;
		border-radius: 50%;
		border: 1px solid var(--color-border-strong);
		pointer-events: none;
		z-index: -1;
	}

	.deco-ring-b {
		position: absolute;
		right: 100px;
		top: -60px;
		width: 150px;
		height: 150px;
		border-radius: 50%;
		border: 1px solid var(--color-lilac);
		pointer-events: none;
		z-index: -1;
	}

	.page-heading h1 {
		margin: 0;
		font-size: clamp(2.25rem, 7vw, 3.5rem);
		line-height: 0.98;
		letter-spacing: -0.035em;
	}

	.tab-desc {
		font-size: 1rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.new-post-btn {
		height: 56px;
		padding: 0 28px;
		flex-shrink: 0;
	}

	/* Tabs row */
	.tabs-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.tab-group {
		display: inline-flex;
		gap: 4px;
		padding: 5px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
	}

	.tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 20px;
		border: none;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-text-strong);
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.tab-btn:hover {
		color: var(--color-text);
	}

	.tab-btn.active {
		background: var(--color-ink);
		color: var(--color-cream);
	}

	.radius-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.radius-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.radius-select {
		height: 44px;
		padding: 0 16px;
		border-radius: var(--radius-pill);
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface);
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text);
		cursor: pointer;
	}

	.radius-select:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.follow-switch {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		height: 44px;
		padding: 0 18px 0 8px;
		border-radius: var(--radius-pill);
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text);
		cursor: pointer;
	}

	.switch-track {
		position: relative;
		width: 44px;
		height: 28px;
		border-radius: var(--radius-pill);
		background: var(--color-border-strong);
		transition: background 0.15s;
		flex-shrink: 0;
	}

	.switch-track.on {
		background: var(--color-primary);
	}

	.switch-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 2px 4px rgba(23, 8, 47, 0.25);
		transition: left 0.15s;
	}

	.switch-track.on .switch-thumb {
		left: 19px;
	}

	/* Feed — single column, Twitter-style scroll */
	.feed {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Featured card */
	.featured-card {
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding: 32px;
		border-radius: var(--radius-card-lg);
		background: var(--color-ink);
		color: var(--color-cream);
		text-decoration: none;
	}

	.featured-text {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.featured-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.featured-author {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.featured-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--color-primary-bright);
		color: white;
		font-weight: 700;
		font-size: 1.05rem;
		flex-shrink: 0;
	}

	.featured-name {
		font-size: 1rem;
		font-weight: 700;
	}

	.top-post-badge {
		padding: 6px 12px;
		border-radius: var(--radius-pill);
		background: rgba(196, 181, 253, 0.16);
		border: 1px solid rgba(196, 181, 253, 0.3);
		color: var(--color-lilac-soft);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.featured-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.featured-tag {
		padding: 5px 12px;
		border-radius: var(--radius-pill);
		background: rgba(255, 255, 255, 0.1);
		color: var(--color-lilac-soft);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.featured-quote {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.25rem, 2.6vw, 1.6rem);
		line-height: 1.25;
		letter-spacing: -0.015em;
	}

	.featured-footer {
		display: flex;
		align-items: center;
		gap: 18px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-lilac-soft);
	}

	.featured-likes {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--color-lilac-soft);
	}

	.featured-thumbs {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	.featured-thumbs.single {
		grid-template-columns: 1fr;
	}

	.featured-thumbs img {
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: 20px;
		object-fit: cover;
		display: block;
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

	/* No location / auth prompt */
	.no-location-card,
	.auth-prompt {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		padding: 56px 32px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		text-align: center;
		box-shadow: var(--shadow-sm);
	}

	.auth-prompt-text {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 800;
		margin: 0;
	}

	.auth-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		margin-top: 8px;
		padding: 0 24px;
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-pill);
		font-size: 0.875rem;
		font-weight: 700;
		text-decoration: none;
		box-shadow: var(--shadow-btn);
		transition: background 0.15s, transform 0.15s;
	}

	.auth-btn:hover {
		background: var(--color-primary-dark);
		transform: translateY(-2px);
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 64px 20px;
		text-align: center;
		background: rgba(255, 255, 255, 0.55);
		border: 2px dashed var(--color-border-strong);
		border-radius: var(--radius-card-lg);
	}

	.empty-icon-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		border-radius: 24px;
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.empty-title {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.empty-sub {
		font-size: 1rem;
		color: var(--color-text-muted);
		max-width: 420px;
		line-height: 1.5;
		margin: 0;
	}

	@media (max-width: 600px) {
		.deco-ring-a, .deco-ring-b {
			display: none;
		}
	}
</style>
