<script lang="ts">
	interface PostMedia {
		url: string;
		media_type: string;
		order_index: number;
	}

	interface Props {
		post: {
			id: string;
			body: string | null;
			youtube_url: string | null;
			created_at: string;
			post_media: PostMedia[];
		};
		likeCount?: number;
	}

	let { post, likeCount = 0 }: Props = $props();

	function stripHtml(html: string | null): string {
		return (html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
	}

	function getYoutubeThumbnail(url: string | null): string | null {
		if (!url) return null;
		const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
		return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
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

	const previewText = stripHtml(post.body);

	const sortedMedia = [...(post.post_media ?? [])].sort((a, b) => a.order_index - b.order_index);
	const images = sortedMedia.filter((m) => m.media_type === 'image');

	// Build up to 2 thumbnail sources: uploaded images first, then YouTube thumbnail as fallback
	const thumbs: string[] = images.slice(0, 2).map((m) => m.url);
	if (thumbs.length < 2 && post.youtube_url) {
		const yt = getYoutubeThumbnail(post.youtube_url);
		if (yt) thumbs.push(yt);
	}

	const hasMedia = thumbs.length > 0;
</script>

<a href="/post/{post.id}" class="post-card" class:no-media={!hasMedia}>
	<div class="post-text">
		{#if previewText}
			<p class="preview">{previewText}</p>
		{:else if post.youtube_url}
			<p class="preview muted">YouTube video</p>
		{:else}
			<p class="preview muted">No content</p>
		{/if}
		<div class="post-footer">
			<span class="date">{timeAgo(post.created_at)}</span>
			{#if likeCount > 0}
				<span class="like-preview">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
					</svg>
					{likeCount}
				</span>
			{/if}
		</div>
	</div>

	{#if hasMedia}
		<div class="post-thumbs" class:single={thumbs.length === 1}>
			{#each thumbs as src}
				<img {src} alt="" />
			{/each}
		</div>
	{/if}
</a>

<style>
	.post-card {
		display: flex;
		gap: 0;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		text-decoration: none;
		color: var(--color-text);
		overflow: hidden;
		transition: border-color 0.15s, box-shadow 0.15s;
		min-height: 110px;
	}

	.post-card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}

	.post-text {
		flex: 1;
		padding: 16px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
	}

	.preview {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--color-text);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.preview.muted {
		color: var(--color-text-muted);
		font-style: italic;
	}

	.post-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.like-preview {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 0.75rem;
		font-weight: 500;
		color: #f43f5e;
	}

	/* Media thumbnails */
	.post-thumbs {
		width: 50%;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--color-border);
	}

	.post-thumbs img {
		flex: 1;
		width: 100%;
		height: 0; /* flex-based height */
		min-height: 0;
		object-fit: cover;
	}

	/* Two thumbnails: add divider between them */
	.post-thumbs:not(.single) img:first-child {
		border-bottom: 1px solid var(--color-border);
	}

	/* Single thumbnail: slightly taller */
	.post-card.no-media .post-text {
		width: 100%;
	}
</style>
