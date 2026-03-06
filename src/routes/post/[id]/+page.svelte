<script lang="ts">
	import MediaCarousel from '$lib/components/MediaCarousel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const post = data.post;
	const profile = post.profiles as { id: string; full_name: string | null; avatar_url: string | null; location: string | null } | null;

	const sortedMedia = [...(post.post_media ?? [])].sort((a: any, b: any) => a.order_index - b.order_index);

	const carouselItems: { type: 'youtube' | 'image'; src: string }[] = [];
	for (const m of sortedMedia) {
		if (m.media_type === 'image') {
			carouselItems.push({ type: 'image', src: m.url });
		}
	}
	if (post.youtube_url) {
		const match = post.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
		if (match) {
			carouselItems.push({ type: 'youtube', src: `https://www.youtube.com/embed/${match[1]}` });
		}
	}

	const hasMedia = carouselItems.length > 0;

	function getInitial(): string {
		const name = profile?.full_name || profile?.id;
		return name?.[0]?.toUpperCase() ?? '?';
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
		<a href="/profile/{profile?.id}" class="author-link">
			<div class="author-avatar">
				{#if profile?.avatar_url}
					<img src={profile.avatar_url} alt={profile.full_name ?? ''} />
				{:else}
					<div class="avatar-initial">{getInitial()}</div>
				{/if}
			</div>
			<div class="author-info">
				<span class="author-name">{profile?.full_name ?? 'Anonymous Artist'}</span>
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

	<div class="post-body" class:no-media={!hasMedia}>
		{#if hasMedia}
			<div class="media-panel">
				<MediaCarousel items={carouselItems} />
			</div>
		{/if}

		<div class="text-panel">
			{#if post.body}
				<div class="post-content">
					{@html post.body}
				</div>
			{:else if !hasMedia}
				<p class="no-content">No content.</p>
			{/if}
		</div>
	</div>
</div>

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
		align-items: center;
		justify-content: space-between;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 16px 20px;
		box-shadow: var(--shadow-sm);
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
		gap: 2px;
	}

	.author-name {
		font-weight: 600;
		font-size: 0.95rem;
		transition: color 0.15s;
	}

	.author-link:hover .author-name {
		color: var(--color-primary);
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
		padding: 28px;
		overflow-y: auto;
		border-left: 1px solid var(--color-border);
	}

	/* Text-only: expand full width */
	.post-body.no-media {
		min-height: unset;
	}

	.post-body.no-media .text-panel {
		border-left: none;
		padding: 36px;
		max-width: 720px;
		margin: 0 auto;
		width: 100%;
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

	.post-content :global(strong) {
		font-weight: 700;
	}

	.post-content :global(em) {
		font-style: italic;
	}

	.no-content {
		font-size: 0.9rem;
		color: var(--color-text-muted);
		font-style: italic;
	}
</style>
