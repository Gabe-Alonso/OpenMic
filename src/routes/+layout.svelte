<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutData } from './$types';
	import type { User } from '@supabase/supabase-js';
	import { createBrowserClient } from '@supabase/ssr';
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
	import '../app.css';

	let { children, data }: { children: any; data: LayoutData } = $props();

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

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app">
	<div class="header-wrap">
		<header>
			<nav class="nav-left">
				<a href="/" class="logo">OpenMic</a>
				<div class="nav-links">
					<a href="/community">Community</a>
					<a href="/artists">Artists</a>
					<a href="/venues">Venues</a>
					<a href="/about">About</a>
				</div>
			</nav>

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
				</div>
			{/if}
		</div>

		<div class="nav-right">
				{#if data.user}
				<a href="/messages" class="envelope-btn" aria-label="Messages">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
						<polyline points="22,6 12,13 2,6"/>
					</svg>
					{#if liveUnreadCount > 0}
						<span class="unread-dot"></span>
					{/if}
				</a>
				{/if}
				<div class="profile-wrapper" class:open={profileMenuOpen}>
					{#if data.user}
						<button class="profile-btn avatar-btn" aria-label="Profile" onclick={handleProfileClick}>
							{#if data.avatarUrl}
								<img src={data.avatarUrl} alt="Profile" class="nav-avatar" />
							{:else}
								{getInitial(data.user)}
							{/if}
						</button>
						<div class="profile-dropdown">
							<p class="dropdown-name">{getDisplayName(data.user)}</p>
							<p class="dropdown-email">{data.user.email}</p>
							<div class="dropdown-divider"></div>
							<a href="/profile" class="dropdown-link" onclick={() => profileMenuOpen = false}>View Profile</a>
							<form method="POST" action="/signout">
								<button type="submit" class="dropdown-signout-btn">Sign Out</button>
							</form>
						</div>
					{:else}
						<button class="profile-btn" aria-label="Profile">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="8" r="4" />
								<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
							</svg>
						</button>
						<div class="profile-dropdown">
							<p class="dropdown-title">Not signed in</p>
							<p class="dropdown-sub">Sign in to connect with artists and venues.</p>
							<a href="/signin" class="dropdown-signin-btn">Sign In</a>
						</div>
					{/if}
				</div>

			<!-- Hamburger (mobile only) -->
			<button class="hamburger-btn" onclick={() => menuOpen = !menuOpen} aria-label="Menu" aria-expanded={menuOpen}>
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
						</div>
					{/if}
				</div>

				<div class="mobile-nav-divider"></div>
				<a href="/community" onclick={() => menuOpen = false}>Community</a>
				<a href="/artists" onclick={() => menuOpen = false}>Artists</a>
				<a href="/venues" onclick={() => menuOpen = false}>Venues</a>
				<a href="/about" onclick={() => menuOpen = false}>About</a>
			</nav>
		{/if}
	</div>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
	}

	.header-wrap {
		padding: 16px 20px 0;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 12px 20px;
		box-shadow: var(--shadow-md);
		border: 1px solid var(--color-border);
	}

	.nav-left {
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.logo {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--color-primary);
		letter-spacing: -0.4px;
	}

	.nav-links {
		display: flex;
		gap: 2px;
	}

	.nav-links a {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		padding: 6px 12px;
		border-radius: var(--radius-sm);
		transition: background 0.15s, color 0.15s;
	}

	.nav-links a:hover {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	/* Profile */
	.nav-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.envelope-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		color: var(--color-text-muted);
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}

	.envelope-btn:hover {
		background: var(--color-primary-light);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.unread-dot {
		position: absolute;
		top: 1px;
		right: 1px;
		width: 9px;
		height: 9px;
		background: #ef4444;
		border-radius: 50%;
		border: 1.5px solid var(--color-surface);
	}

	.profile-wrapper {
		position: relative;
	}

	.profile-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		color: var(--color-text-muted);
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}

	.profile-btn:hover {
		background: var(--color-primary-light);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.avatar-btn {
		background: var(--color-primary);
		border-color: var(--color-primary);
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
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
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

	/* Signed-out dropdown */
	.dropdown-title {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.dropdown-sub {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		line-height: 1.45;
	}

	.dropdown-signin-btn {
		display: block;
		text-align: center;
		background: var(--color-primary);
		color: white;
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		transition: background 0.15s;
	}

	.dropdown-signin-btn:hover {
		background: var(--color-primary-dark);
	}

	/* Signed-in dropdown */
	.dropdown-name {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.dropdown-email {
		font-size: 0.78rem;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dropdown-divider {
		height: 1px;
		background: var(--color-border);
		margin: 2px 0;
	}

	.dropdown-link {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		transition: background 0.15s;
	}

	.dropdown-link:hover {
		background: var(--color-bg);
	}

	.dropdown-signout-btn {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		font-size: 0.875rem;
		font-weight: 500;
		color: #dc2626;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		transition: background 0.15s;
	}

	.dropdown-signout-btn:hover {
		background: #fef2f2;
	}

	main {
		padding: 28px 20px;
	}

	/* Search */
	.search-wrap {
		position: relative;
		flex: 1;
		max-width: 280px;
		margin: 0 12px;
	}

	.search-input-row {
		display: flex;
		align-items: center;
		gap: 7px;
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 7px 10px;
		transition: border-color 0.15s, background 0.15s;
	}

	.search-input-row:focus-within {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	.search-icon {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		border: none;
		background: none;
		font-size: 0.85rem;
		color: var(--color-text);
		outline: none;
		font-family: inherit;
		min-width: 0;
	}

	.search-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	/* hide browser's built-in clear button */
	.search-input::-webkit-search-cancel-button { display: none; }

	.search-clear {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		flex-shrink: 0;
		transition: color 0.15s;
	}

	.search-clear:hover {
		color: var(--color-text);
	}

	.search-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		right: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
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
		background: var(--color-primary);
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
		color: var(--color-primary);
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
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.result-divider {
		height: 1px;
		background: var(--color-border);
		margin: 2px 8px;
	}

	.search-status {
		padding: 14px 16px;
		text-align: center;
		font-size: 0.825rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Hamburger (hidden on desktop) */
	.hamburger-btn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: var(--radius-sm);
		background: none;
		border: 1.5px solid var(--color-border);
		color: var(--color-text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s, color 0.15s;
	}

	.hamburger-btn:hover {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	/* Mobile nav drawer (hidden on desktop) */
	.mobile-nav {
		display: none;
	}

	@media (max-width: 768px) {
		.nav-links {
			display: none;
		}

		.hamburger-btn {
			display: flex;
		}

		.search-wrap {
			display: none;
		}

		.mobile-nav {
			display: flex;
			flex-direction: column;
			background: var(--color-surface);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-lg);
			margin-top: 8px;
			padding: 8px;
			gap: 2px;
			box-shadow: var(--shadow-md);
		}

		.mobile-nav a {
			font-size: 0.925rem;
			font-weight: 500;
			color: var(--color-text-muted);
			padding: 12px 16px;
			border-radius: var(--radius-sm);
			transition: background 0.15s, color 0.15s;
			text-decoration: none;
		}

		.mobile-nav a:hover {
			background: var(--color-primary-light);
			color: var(--color-primary);
		}

		.mobile-search {
			padding: 4px 4px 0;
		}

		.mobile-search-results {
			margin-top: 6px;
			border-top: 1px solid var(--color-border);
			padding-top: 4px;
		}

		.mobile-nav-divider {
			height: 1px;
			background: var(--color-border);
			margin: 6px 8px;
		}

		main {
			padding: 16px 12px;
		}
	}
</style>
