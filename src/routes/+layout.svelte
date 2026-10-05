<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';
	import type { User } from '@supabase/supabase-js';
	import { createBrowserClient } from '@supabase/ssr';
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
	import '../app.css';

	let { children, data }: { children: any; data: LayoutData } = $props();

	const navLinks = [
		{ href: '/community', label: 'Community', match: (p: string) => p.startsWith('/community') || p.startsWith('/tags') || p.startsWith('/post') },
		{ href: '/artists', label: 'Artists', match: (p: string) => p.startsWith('/artists') },
		{ href: '/venues', label: 'Venues', match: (p: string) => p.startsWith('/venues') },
		{ href: '/about', label: 'About', match: (p: string) => p.startsWith('/about') }
	];

	// Live unread count — initialised from server, updated by Realtime
	let liveUnreadCount = $state(data.unreadCount ?? 0);

	// Sync back to server value whenever the layout server load re-runs (e.g. after invalidateAll)
	$effect(() => {
		liveUnreadCount = data.unreadCount ?? 0;
	});

	let realtimeChannel: any;

	onMount(() => {
		if (!data.user) return;
		const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
		realtimeChannel = supabase
			.channel('layout-unread')
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'messages' },
				(payload: any) => {
					const msg = payload.new;
					// Only count messages from the other person that haven't been read yet.
					// If the user is actively viewing that conversation, skip — the thread
					// page's invalidateAll() will reset the count when they leave.
					if (
						msg.sender_id !== data.user!.id &&
						!$page.url.pathname.startsWith(`/messages/${msg.conversation_id}`)
					) {
						liveUnreadCount += 1;
					}
				}
			)
			.subscribe();
	});

	onDestroy(() => {
		realtimeChannel?.unsubscribe();
	});

	function getInitial(user: User): string {
		const name = user.user_metadata?.full_name as string | undefined;
		if (name?.length) return name[0].toUpperCase();
		return user.email?.[0].toUpperCase() ?? '?';
	}

	function getDisplayName(user: User): string {
		return (user.user_metadata?.full_name as string) || user.email || 'User';
	}

	// Search
	let searchQuery = $state('');
	let searchResults = $state<{ profiles: any[]; posts: any[] }>({ profiles: [], posts: [] });
	let searchLoading = $state(false);
	let showResults = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	function handleSearchInput() {
		const q = searchQuery.trim();
		if (searchTimer) clearTimeout(searchTimer);
		if (q.length < 2) {
			showResults = false;
			searchResults = { profiles: [], posts: [] };
			return;
		}
		searchLoading = true;
		showResults = true;
		searchTimer = setTimeout(async () => {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
			if (res.ok) searchResults = await res.json();
			searchLoading = false;
		}, 280);
	}

	function handleSearchFocusOut(e: FocusEvent) {
		if (!(e.currentTarget as Element).contains(e.relatedTarget as Node | null)) {
			setTimeout(() => { showResults = false; }, 120);
		}
	}

	function selectResult() {
		showResults = false;
		searchQuery = '';
		searchResults = { profiles: [], posts: [] };
	}

	// Mobile menu
	let menuOpen = $state(false);

	// Profile dropdown (mobile: toggle on click; desktop: CSS hover)
	let profileMenuOpen = $state(false);

	function handleProfileClick() {
		profileMenuOpen = !profileMenuOpen;
	}
</script>

{#snippet searchResultsList()}
	{#if searchLoading}
		<p class="search-status">Searching…</p>
	{:else if searchResults.profiles.length === 0 && searchResults.posts.length === 0}
		<p class="search-status">No results for "{searchQuery}"</p>
	{:else}
		{#if searchResults.profiles.length > 0}
			<div class="result-section">
				<p class="result-label">People</p>
				{#each searchResults.profiles as p (p.id)}
					<a href="/profile/{p.id}" class="result-item" onclick={selectResult}>
						<div class="result-avatar">
							{#if p.avatar_url}
								<img src={p.avatar_url} alt={p.full_name ?? ''} />
							{:else}
								{(p.full_name ?? '?')[0]?.toUpperCase()}
							{/if}
						</div>
						<div class="result-text">
							<div class="result-name-row">
								<span class="result-name">{p.full_name ?? 'Unknown'}</span>
								{#if p.profile_type}
									<span class="result-type-badge">{p.profile_type}</span>
								{/if}
							</div>
							{#if p.location}<p class="result-sub">{p.location}</p>{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}

		{#if searchResults.profiles.length > 0 && searchResults.posts.length > 0}
			<div class="result-divider"></div>
		{/if}

		{#if searchResults.posts.length > 0}
			<div class="result-section">
				<p class="result-label">Posts</p>
				{#each searchResults.posts as post (post.id)}
					<a href="/community" class="result-item" onclick={selectResult}>
						<div class="result-avatar">
							{#if post.author?.avatar_url}
								<img src={post.author.avatar_url} alt={post.author?.full_name ?? ''} />
							{:else}
								{(post.author?.full_name ?? '?')[0]?.toUpperCase()}
							{/if}
						</div>
						<div class="result-text">
							{#if post.tags?.length}
								<div class="result-tags">
									{#each post.tags as t}
										<span class="result-tag">#{t}</span>
									{/each}
								</div>
							{/if}
							<p class="result-content">{post.content}</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
{/snippet}

{#snippet accountActions(mobile: boolean)}
	{#if data.user}
		<p class="account-name">{getDisplayName(data.user)}</p>
		<p class="account-email">{data.user.email}</p>
		<a href="/profile" class="account-link" onclick={() => { if (mobile) menuOpen = false; profileMenuOpen = false; }}>View Profile</a>
		<form method="POST" action="/signout">
			<button type="submit" class="account-signout-btn">Sign Out</button>
		</form>
	{:else}
		<a href="/signin" class="btn btn-outline account-btn" onclick={() => menuOpen = false}>Sign In</a>
		<a href="/signup" class="btn btn-cream account-btn" onclick={() => menuOpen = false}>Sign Up</a>
	{/if}
{/snippet}

<div class="app">
	<div class="header-wrap">
		<header class="nav-pill">
			<div class="nav-left">
				<a href="/" class="logo">
					<span class="logo-tile" aria-hidden="true">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
							<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
							<line x1="12" y1="19" x2="12" y2="23" />
							<line x1="8" y1="23" x2="16" y2="23" />
						</svg>
					</span>
					<span class="logo-word">OpenMic</span>
				</a>
				<div class="nav-links">
					{#each navLinks as link}
						{@const isActive = link.match($page.url.pathname)}
						<a href={link.href} class:active={isActive} aria-current={isActive ? 'page' : undefined}>{link.label}</a>
					{/each}
				</div>
			</div>

			<div class="nav-right">
				<!-- Search -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div class="search-wrap" role="search" onfocusout={handleSearchFocusOut}>
					<div class="search-input-row">
						<svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
						</svg>
						<input
							class="search-input"
							type="search"
							placeholder="Search artists, venues, #tags…"
							bind:value={searchQuery}
							oninput={handleSearchInput}
							onkeydown={(e) => { if (e.key === 'Escape') { showResults = false; searchQuery = ''; } }}
							autocomplete="off"
						/>
						{#if searchQuery}
							<button class="search-clear" onclick={() => { searchQuery = ''; showResults = false; }} aria-label="Clear search">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
							</button>
						{/if}
					</div>

					{#if showResults}
						<div class="search-dropdown">
							{@render searchResultsList()}
						</div>
					{/if}
				</div>

				{#if data.user}
					<a href="/messages" class="icon-btn" aria-label="Messages">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
							<polyline points="22,6 12,13 2,6"/>
						</svg>
						{#if liveUnreadCount > 0}
							<span class="unread-dot"></span>
						{/if}
					</a>
					<div class="profile-wrapper" class:open={profileMenuOpen}>
						<button class="icon-btn avatar-btn" aria-label="Profile" onclick={handleProfileClick}>
							{#if data.avatarUrl}
								<img src={data.avatarUrl} alt="Profile" class="nav-avatar" />
							{:else}
								{getInitial(data.user)}
							{/if}
						</button>
						<div class="profile-dropdown">
							{@render accountActions(false)}
						</div>
					</div>
				{:else}
					<a href="/signin" class="signin-link">Sign in</a>
					<a href="/signup" class="signup-pill">Sign up</a>
				{/if}

				<!-- Hamburger (mobile only) -->
				<button class="icon-btn hamburger-btn" onclick={() => menuOpen = !menuOpen} aria-label="Menu" aria-expanded={menuOpen}>
					{#if menuOpen}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
					{:else}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
					{/if}
				</button>
			</div>
		</header>

		{#if menuOpen}
			<nav class="mobile-nav">
				<!-- Search inside hamburger menu -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div class="mobile-search" role="search" onfocusout={handleSearchFocusOut}>
					<div class="search-input-row">
						<svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
						</svg>
						<input
							class="search-input"
							type="search"
							placeholder="Search artists, venues, #tags…"
							bind:value={searchQuery}
							oninput={handleSearchInput}
							onkeydown={(e) => { if (e.key === 'Escape') { showResults = false; searchQuery = ''; } }}
							autocomplete="off"
						/>
						{#if searchQuery}
							<button class="search-clear" onclick={() => { searchQuery = ''; showResults = false; }} aria-label="Clear search">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
							</button>
						{/if}
					</div>

					{#if showResults}
						<div class="mobile-search-results">
							{@render searchResultsList()}
						</div>
					{/if}
				</div>

				<div class="mobile-nav-divider"></div>
				{#each navLinks as link}
					{@const isActive = link.match($page.url.pathname)}
					<a href={link.href} class:active={isActive} aria-current={isActive ? 'page' : undefined} onclick={() => menuOpen = false}>{link.label}</a>
				{/each}

				<div class="mobile-nav-divider"></div>
				<div class="mobile-account">
					{@render accountActions(true)}
				</div>
			</nav>
		{/if}
	</div>

	<main>
		{@render children()}
	</main>

	<footer>
		<a href="/" class="footer-logo">OpenMic</a>
		<div class="footer-links">
			{#each navLinks as link}
				<a href={link.href}>{link.label}</a>
			{/each}
		</div>
	</footer>
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.header-wrap {
		padding: 20px 24px 0;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-pill {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 1200px;
		margin: 0 auto;
		background: var(--color-panel);
		border-radius: var(--radius-pill);
		padding: 10px 10px 10px 20px;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.nav-left {
		display: flex;
		align-items: center;
		gap: 28px;
		min-width: 0;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.logo-tile {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--color-cream);
		color: var(--color-ink);
		display: flex;
		align-items: center;
		justify-content: center;
		transform: rotate(-6deg);
		flex-shrink: 0;
	}

	.logo-word {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.2rem;
		color: #fff;
		letter-spacing: -0.02em;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.nav-links a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-size: 0.875rem;
		font-weight: 500;
		color: #cfc3f0;
		padding: 0 16px;
		border-radius: var(--radius-pill);
		transition: background 0.15s, color 0.15s;
	}

	.nav-links a:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.nav-links a.active {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		font-weight: 600;
	}

	.nav-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	/* Search */
	.search-wrap {
		position: relative;
		width: 220px;
	}

	.search-input-row {
		display: flex;
		align-items: center;
		gap: 7px;
		background: rgba(255, 255, 255, 0.08);
		border: 1.5px solid rgba(255, 255, 255, 0.14);
		border-radius: var(--radius-pill);
		padding: 9px 14px;
		transition: border-color 0.15s, background 0.15s;
	}

	.search-input-row:focus-within {
		border-color: var(--color-lilac);
		background: rgba(255, 255, 255, 0.12);
	}

	.search-icon {
		color: #cfc3f0;
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		border: none;
		background: none;
		font-size: 0.85rem;
		color: #fff;
		outline: none;
		font-family: inherit;
		min-width: 0;
	}

	.search-input::placeholder {
		color: #cfc3f0;
		opacity: 0.8;
	}

	.search-input::-webkit-search-cancel-button { display: none; }

	.search-clear {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: #cfc3f0;
		display: flex;
		align-items: center;
		flex-shrink: 0;
		transition: color 0.15s;
	}

	.search-clear:hover {
		color: #fff;
	}

	.search-dropdown {
		position: absolute;
		top: calc(100% + 10px);
		left: 0;
		right: -60px;
		background: var(--color-surface);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-card-hover);
		z-index: 300;
		max-height: 420px;
		overflow-y: auto;
	}

	.result-section {
		padding: 6px;
	}

	.result-label {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--color-text-muted);
		padding: 4px 8px 5px;
		margin: 0;
	}

	.result-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: var(--color-text);
		transition: background 0.1s;
	}

	.result-item:hover {
		background: var(--color-bg);
	}

	.result-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--color-primary-bright);
		color: white;
		font-size: 0.8rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}

	.result-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.result-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.result-name-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.result-name {
		font-size: 0.875rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.result-type-badge {
		font-size: 0.65rem;
		padding: 2px 6px;
		border-radius: 999px;
		background: var(--color-primary-light);
		color: var(--color-primary-deep);
		font-weight: 600;
		text-transform: capitalize;
		flex-shrink: 0;
	}

	.result-sub {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.result-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.result-tag {
		font-size: 0.68rem;
		padding: 1px 6px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-muted);
	}

	.result-content {
		font-size: 0.78rem;
		color: var(--color-text-muted);
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.result-divider {
		height: 1px;
		background: var(--color-border-soft);
		margin: 2px 8px;
	}

	.search-status {
		padding: 14px 16px;
		text-align: center;
		font-size: 0.825rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Icon buttons (messages, avatar, generic profile, hamburger) */
	button.hamburger-btn {
		display: none;
	}

	.icon-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
		border: 1.5px solid rgba(255, 255, 255, 0.14);
		color: #cfc3f0;
		flex-shrink: 0;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}

	.icon-btn:hover {
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
	}

	.unread-dot {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 9px;
		height: 9px;
		background: #ef4444;
		border-radius: 50%;
		border: 1.5px solid var(--color-panel);
	}

	.profile-wrapper {
		position: relative;
	}

	.avatar-btn {
		background: var(--color-primary-bright);
		border-color: var(--color-primary-bright);
		color: white;
		font-weight: 700;
		font-size: 0.9rem;
		overflow: hidden;
		padding: 0;
	}

	.nav-avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
	}

	.avatar-btn:hover {
		background: var(--color-primary-dark);
		border-color: var(--color-primary-dark);
		color: white;
	}

	.profile-dropdown {
		display: flex;
		flex-direction: column;
		gap: 8px;
		position: absolute;
		right: 0;
		top: calc(100% + 10px);
		background: var(--color-surface);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-card-hover);
		padding: 16px;
		width: 220px;
		z-index: 200;
		visibility: hidden;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s, visibility 0s linear 0.15s, pointer-events 0s linear 0.15s;
	}

	.profile-wrapper.open .profile-dropdown {
		visibility: visible;
		opacity: 1;
		pointer-events: auto;
		transition: opacity 0.15s, visibility 0s, pointer-events 0s;
	}

	.account-name {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-text);
	}

	.account-email {
		font-size: 0.78rem;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.account-link {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		padding: 8px;
		border-radius: var(--radius-sm);
		transition: background 0.15s;
	}

	.account-link:hover {
		background: var(--color-bg);
	}

	.account-signout-btn {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-danger);
		padding: 8px;
		border-radius: var(--radius-sm);
		transition: background 0.15s;
	}

	.account-signout-btn:hover {
		background: var(--color-danger-bg);
	}

	/* Signed-out nav actions */
	.signin-link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 14px;
		font-size: 0.875rem;
		font-weight: 600;
		color: #cfc3f0;
		border-radius: var(--radius-pill);
		transition: color 0.15s;
	}

	.signin-link:hover {
		color: #fff;
	}

	.signup-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 20px;
		background: var(--color-cream);
		color: var(--color-ink);
		font-size: 0.875rem;
		font-weight: 700;
		border-radius: var(--radius-pill);
		transition: background 0.15s, transform 0.15s;
	}

	.signup-pill:hover {
		background: #fff;
		transform: translateY(-1px);
	}

	/* Mobile nav drawer */
	.mobile-nav {
		display: none;
	}

	main {
		flex: 1;
		padding: 28px 20px;
	}

	footer {
		max-width: 1200px;
		width: 100%;
		margin: 0 auto;
		padding: 32px 24px 40px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 16px;
	}

	.footer-logo {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.1rem;
		color: var(--color-primary-deep);
		letter-spacing: -0.02em;
	}

	.footer-links {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
	}

	.footer-links a {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		transition: color 0.15s;
	}

	.footer-links a:hover {
		color: var(--color-primary-dark);
	}

	@media (max-width: 860px) {
		.nav-links {
			display: none;
		}

		.search-wrap,
		.signin-link,
		.signup-pill {
			display: none;
		}

		button.hamburger-btn {
			display: flex;
		}

		.mobile-nav {
			display: flex;
			flex-direction: column;
			background: var(--color-panel);
			border-radius: var(--radius-card);
			margin: 8px 0 0;
			padding: 12px;
			gap: 2px;
			max-width: 1200px;
			margin-left: auto;
			margin-right: auto;
			box-shadow: var(--shadow-md);
		}

		.mobile-nav a {
			display: flex;
			align-items: center;
			min-height: 44px;
			font-size: 0.925rem;
			font-weight: 500;
			color: #cfc3f0;
			padding: 0 16px;
			border-radius: var(--radius-sm);
			transition: background 0.15s, color 0.15s;
			text-decoration: none;
		}

		.mobile-nav a:hover,
		.mobile-nav a.active {
			background: rgba(255, 255, 255, 0.1);
			color: #fff;
		}

		.mobile-search {
			padding: 4px 4px 0;
		}

		.mobile-search-results {
			margin-top: 6px;
			border-top: 1px solid rgba(255, 255, 255, 0.14);
			padding-top: 4px;
		}

		.mobile-search-results :global(.result-label),
		.mobile-search-results :global(.search-status) {
			color: #cfc3f0;
		}

		.mobile-search-results :global(.result-item) {
			color: #fff;
		}

		.mobile-search-results :global(.result-item:hover) {
			background: rgba(255, 255, 255, 0.08);
		}

		.mobile-nav-divider {
			height: 1px;
			background: rgba(255, 255, 255, 0.14);
			margin: 6px 8px;
		}

		.mobile-account {
			display: flex;
			flex-direction: column;
			gap: 8px;
			padding: 8px 16px 4px;
		}

		.mobile-account .account-name {
			color: #fff;
		}

		.mobile-account .account-email {
			color: #cfc3f0;
		}

		.mobile-account .account-link {
			color: #fff;
		}

		.mobile-account .account-link:hover {
			background: rgba(255, 255, 255, 0.1);
		}

		.mobile-account .account-signout-btn {
			color: #f8b4ac;
		}

		.mobile-account .account-signout-btn:hover {
			background: rgba(255, 255, 255, 0.1);
		}

		.mobile-account .account-btn {
			width: 100%;
		}

		main {
			padding: 16px 12px;
		}

		footer {
			flex-direction: column;
			text-align: center;
			padding: 24px 20px 32px;
		}
	}
</style>
