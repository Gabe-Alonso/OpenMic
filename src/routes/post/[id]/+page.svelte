<script lang="ts">
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import MediaCarousel from '$lib/components/MediaCarousel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const post = $derived(data.post);
	const profile = $derived(
		post.profiles as { id: string; full_name: string | null; avatar_url: string | null; location: string | null } | null
	);
	const sortedMedia = $derived(
		[...(post.post_media ?? [])].sort((a: any, b: any) => a.order_index - b.order_index)
	);
	const carouselItems = $derived.by((): { type: 'youtube' | 'image'; src: string }[] => {
		const items: { type: 'youtube' | 'image'; src: string }[] = [];
		for (const m of sortedMedia) {
			if (m.media_type === 'image') items.push({ type: 'image', src: m.url });
		}
		if (post.youtube_url) {
			const match = post.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
			if (match) items.push({ type: 'youtube', src: `https://www.youtube.com/embed/${match[1]}` });
		}
		return items;
	});
	const hasMedia = $derived(carouselItems.length > 0);

	// Like state — seed from server once, then updated optimistically client-side
	let likeCount = $state(untrack(() => data.likeCount));
	let userLiked = $state(untrack(() => data.userLiked));
	let liking = $state(false);
	let showLikers = $state(false);
	let copied = $state(false);

	async function toggleLike() {
		if (liking) return;
		liking = true;
		const wasLiked = userLiked;
		userLiked = !wasLiked;
		likeCount += wasLiked ? -1 : 1;

		const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
		if (res.ok) {
			const json = await res.json();
			likeCount = json.count;
			userLiked = json.liked;
		} else {
			// Revert optimistic update
			userLiked = wasLiked;
			likeCount += wasLiked ? 1 : -1;
			if (res.status === 401) goto('/signin');
		}
		liking = false;
	}

	async function share() {
		const url = window.location.href;
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ url });
			} else {
				await navigator.clipboard.writeText(url);
				copied = true;
				setTimeout(() => (copied = false), 2000);
			}
		} catch {
			// user cancelled or clipboard unavailable
		}
	}

	function getInitial(): string {
		const name = profile?.full_name || profile?.id;
		return name?.[0]?.toUpperCase() ?? '?';
	}

	function formatMutuals(mutuals: { id: string; full_name: string | null }[]): string {
		const shown = mutuals.slice(0, 3);
		const names = shown.map((m) => m.full_name ?? 'someone').join(', ');
		const extra = mutuals.length - 3;
		if (extra > 0) return `${names} ... and ${extra} more`;
		return names;
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		if (days < 30) return `${days}d ago`;
		return new Date(dateStr).toLocaleDateString();
	}
</script>

<div class="post-page">
	<div class="post-header">
		<div class="post-header-top">
			<a href="/profile/{profile?.id}" class="author-link">
				<div class="author-avatar">
					{#if profile?.avatar_url}
						<img src={profile.avatar_url} alt={profile.full_name ?? ''} />
					{:else}
						<div class="avatar-initial">{getInitial()}</div>
					{/if}
				</div>
				<div class="author-info">
					<div class="author-name-row">
						<span class="author-name">{profile?.full_name ?? 'Anonymous Artist'}</span>
						<span class="author-stats">
							<strong>{data.authorFollowerCount}</strong> followers
							<span class="stats-dot">·</span>
							<strong>{data.authorFollowingCount}</strong> following
						</span>
					</div>
					{#if profile?.location}
						<span class="author-location">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z" />
								<circle cx="12" cy="10" r="3" />
							</svg>
							{profile.location}
						</span>
					{/if}
				</div>
			</a>
			<span class="post-date">{timeAgo(post.created_at)}</span>
		</div>

		{#if data.mutuals.length > 0}
			<div class="post-mutuals">
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

	<div class="post-body" class:no-media={!hasMedia}>
		{#if hasMedia}
			<div class="media-panel">
				<MediaCarousel items={carouselItems} />
			</div>
		{/if}

		<div class="text-panel">
			<div class="text-content">
				{#if post.body}
					<div class="post-content">
						{@html post.body}
					</div>
				{:else if !hasMedia}
					<p class="no-content">No content.</p>
				{/if}
			</div>

			<div class="post-actions">
				<div class="like-group">
					<button
						class="like-btn"
						class:liked={userLiked}
						onclick={toggleLike}
						disabled={liking}
						aria-label={userLiked ? 'Unlike' : 'Like'}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill={userLiked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
						</svg>
					</button>
					{#if likeCount > 0}
						<button class="like-count-btn" onclick={() => (showLikers = true)}>
							{likeCount}
						</button>
					{:else}
						<span class="like-count-zero">0</span>
					{/if}
				</div>

				<button class="share-btn" onclick={share} class:share-copied={copied}>
					{#if copied}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12" />
						</svg>
						Copied!
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
							<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
						</svg>
						Share
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>

<!-- Likers modal -->
{#if showLikers}
	<div class="modal-backdrop" onclick={() => (showLikers = false)} role="presentation">
		<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="People who liked this" tabindex="-1">
			<div class="modal-header">
				<h2>Liked by</h2>
				<button class="modal-close" onclick={() => (showLikers = false)} aria-label="Close">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="likers-list">
				{#each data.likers as liker}
					{@const p = liker.profiles as any}
					<a href="/profile/{p?.id}" class="liker-item" onclick={() => (showLikers = false)}>
						<div class="liker-avatar">
							{#if p?.avatar_url}
								<img src={p.avatar_url} alt={p.full_name ?? ''} />
							{:else}
								<div class="liker-initial">{p?.full_name?.[0]?.toUpperCase() ?? '?'}</div>
							{/if}
						</div>
						<span class="liker-name">{p?.full_name ?? 'Anonymous Artist'}</span>
					</a>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.post-page {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* Author header */
	.post-header {
		display: flex;
		flex-direction: column;
		gap: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
	}

	.post-header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
	}

	.author-link {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		color: inherit;
	}

	.author-avatar {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
	}

	.author-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-initial {
		width: 100%;
		height: 100%;
		background: var(--color-primary);
		color: white;
		font-weight: 700;
		font-size: 1.1rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.author-info {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.author-name-row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 8px;
	}

	.author-name {
		font-weight: 600;
		font-size: 0.95rem;
		transition: color 0.15s;
		flex-shrink: 0;
	}

	.author-link:hover .author-name {
		color: var(--color-primary);
	}

	.author-stats {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	.author-stats strong {
		color: var(--color-text);
		font-weight: 600;
	}

	.stats-dot {
		opacity: 0.5;
	}

	.author-location {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.post-date {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	/* Mutuals in post header */
	.post-mutuals {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 20px;
		border-top: 1px solid var(--color-border);
		background: var(--color-bg);
	}

	.mutual-avatars {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.mutual-avatar {
		width: 22px;
		height: 22px;
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
		font-size: 0.55rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mutuals-text {
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	/* Body: 2/3 media + 1/3 text */
	.post-body {
		display: flex;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		min-height: 480px;
	}

	.media-panel {
		flex: 2;
		min-width: 0;
		background: #000;
	}

	.text-panel {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--color-border);
		overflow: hidden;
	}

	.text-content {
		flex: 1;
		padding: 28px;
		overflow-y: auto;
	}

	/* Text-only: full width */
	.post-body.no-media {
		min-height: unset;
	}

	.post-body.no-media .text-panel {
		border-left: none;
	}

	.post-body.no-media .text-content {
		max-width: 720px;
		margin: 0 auto;
		width: 100%;
		padding: 36px;
	}

	/* Rich text content */
	.post-content :global(p) {
		margin: 0 0 1em;
		font-size: 0.95rem;
		line-height: 1.7;
		color: var(--color-text);
	}

	.post-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.post-content :global(h2) {
		font-size: 1.15rem;
		font-weight: 700;
		margin: 0 0 0.6em;
		letter-spacing: -0.3px;
	}

	.post-content :global(ul),
	.post-content :global(ol) {
		padding-left: 1.4em;
		margin: 0 0 1em;
		font-size: 0.95rem;
		line-height: 1.7;
	}

	.post-content :global(strong) { font-weight: 700; }
	.post-content :global(em) { font-style: italic; }

	.no-content {
		font-size: 0.9rem;
		color: var(--color-text-muted);
		font-style: italic;
	}

	/* Actions bar */
	.post-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 12px 20px;
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.like-group {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-right: 8px;
	}

	.like-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: color 0.15s, background 0.15s, transform 0.1s;
	}

	.like-btn:hover {
		color: #f43f5e;
		background: #fff1f2;
	}

	.like-btn.liked {
		color: #f43f5e;
	}

	.like-btn:active {
		transform: scale(0.88);
	}

	.like-btn:disabled {
		cursor: default;
	}

	.like-count-btn {
		background: none;
		border: none;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 4px 6px;
		border-radius: var(--radius-sm);
		transition: color 0.15s, background 0.15s;
		min-width: 20px;
		text-align: left;
	}

	.like-count-btn:hover {
		color: var(--color-text);
		background: var(--color-bg);
	}

	.like-count-zero {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		padding: 4px 6px;
	}

	.share-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 7px 14px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}

	.share-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.share-btn.share-copied {
		border-color: #16a34a;
		color: #16a34a;
		background: #f0fdf4;
	}

	/* Likers modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.modal {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		width: 100%;
		max-width: 360px;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.modal-header h2 {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.2px;
	}

	.modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.modal-close:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}

	.likers-list {
		overflow-y: auto;
		padding: 8px;
	}

	.liker-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: background 0.15s;
	}

	.liker-item:hover {
		background: var(--color-bg);
	}

	.liker-avatar {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
	}

	.liker-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.liker-initial {
		width: 100%;
		height: 100%;
		background: var(--color-primary);
		color: white;
		font-weight: 700;
		font-size: 0.95rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.liker-name {
		font-size: 0.9rem;
		font-weight: 500;
	}
</style>
