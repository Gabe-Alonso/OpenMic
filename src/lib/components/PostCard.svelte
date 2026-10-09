<script lang="ts">
	import { untrack } from 'svelte';
	import { stripHtml, timeAgo } from '$lib/format';
	import { goto } from '$app/navigation';
	interface PostMedia {
		url: string;
		media_type: string;
		order_index: number;
	}

	interface RepostedBy {
		id: string;
		full_name: string | null;
	}

	interface Props {
		post: {
			id: string;
			body: string | null;
			youtube_url: string | null;
			created_at: string;
			post_media: PostMedia[];
			tags?: string[] | null;
			profiles?: { id: string; full_name: string | null; avatar_url: string | null } | null;
			likeCount?: number;
			commentCount?: number;
			repostCount?: number;
			likedByMe?: boolean;
			repostedByMe?: boolean;
			repostedBy?: RepostedBy | null;
		};
		// Overrides post.likeCount when passed — kept for the other pages that
		// still compute their own separate likeCounts map (profile pages, tag
		// pages) rather than the embedded-field convention the community feed
		// now uses. Not worth migrating those for this change; they don't need
		// comment/repost counts shown at all.
		likeCount?: number;
		showAuthor?: boolean;
		featured?: boolean;
	}

	let { post, likeCount: likeCountProp, showAuthor = false, featured = false }: Props = $props();

	let shared = $state(false);
	let liked = $state(untrack(() => post.likedByMe ?? false));
	let likeCount = $state(untrack(() => likeCountProp ?? post.likeCount ?? 0));
	let liking = $state(false);
	let reposted = $state(untrack(() => post.repostedByMe ?? false));
	let repostCount = $state(untrack(() => post.repostCount ?? 0));
	let reposting = $state(false);

	async function toggleLike(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (liking) return;
		liking = true;
		const was = liked;
		liked = !was;
		likeCount += was ? -1 : 1;

		const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
		if (res.ok) {
			const json = await res.json();
			liked = json.liked;
			likeCount = json.count;
		} else {
			liked = was;
			likeCount += was ? 1 : -1;
			if (res.status === 401) goto('/signin');
		}
		liking = false;
	}

	async function toggleRepost(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (reposting) return;
		reposting = true;
		const was = reposted;
		reposted = !was;
		repostCount += was ? -1 : 1;

		const res = await fetch(`/api/posts/${post.id}/repost`, { method: 'POST' });
		if (res.ok) {
			const json = await res.json();
			reposted = json.reposted;
			repostCount = json.count;
		} else {
			reposted = was;
			repostCount += was ? 1 : -1;
			if (res.status === 401) goto('/signin');
		}
		reposting = false;
	}

	async function share(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const url = `${window.location.origin}/post/${post.id}`;
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ url });
			} else {
				await navigator.clipboard.writeText(url);
				shared = true;
				setTimeout(() => (shared = false), 2000);
			}
		} catch {
			// user cancelled or clipboard unavailable
		}
	}

	function getYoutubeThumbnail(url: string | null): string | null {
		if (!url) return null;
		const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
		return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
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
	const postCardTags = (post.tags ?? []).slice(0, 3);

	function goToTag(e: MouseEvent, tag: string) {
		e.preventDefault();
		e.stopPropagation();
		goto('/tags/' + tag);
	}

</script>

<div class="post-card" class:featured>
	{#if post.repostedBy}
		<div class="repost-banner">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
				<path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
			</svg>
			<a href="/profile/{post.repostedBy.id}" onclick={(e) => e.stopPropagation()}>{post.repostedBy.full_name ?? 'Someone'}</a>
			reposted this
		</div>
	{/if}
	{#if featured}
		<span class="eyebrow featured-eyebrow">Featured</span>
	{/if}

	<a href="/post/{post.id}" class="card-link">
		{#if showAuthor && post.profiles}
			<div class="author-row">
				<div class="author-avatar">
					{#if post.profiles.avatar_url}
						<img src={post.profiles.avatar_url} alt={post.profiles.full_name ?? ''} />
					{:else}
						<span>{post.profiles.full_name?.[0]?.toUpperCase() ?? '?'}</span>
					{/if}
				</div>
				<span class="author-name">{post.profiles.full_name ?? 'Anonymous Artist'}</span>
			</div>
		{/if}

		{#if previewText}
			<p class="preview">{previewText}</p>
		{:else if post.youtube_url}
			<p class="preview muted">YouTube video</p>
		{:else}
			<p class="preview muted">No content</p>
		{/if}

		{#if hasMedia}
			<div class="thumb-grid" class:single={thumbs.length === 1}>
				{#each thumbs as src}
					<img {src} alt="" />
				{/each}
			</div>
		{/if}
	</a>

	{#if postCardTags.length > 0}
		<div class="card-tags">
			{#each postCardTags as tag}
				<button class="card-tag" onclick={(e) => goToTag(e, tag)}>#{tag}</button>
			{/each}
		</div>
	{/if}

	<div class="post-footer">
		<div class="footer-actions">
			<button class="action-btn like-btn" class:active={liked} onclick={toggleLike} disabled={liking} aria-label="Like">
				<svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
				</svg>
				{likeCount}
			</button>
			<button class="action-btn repost-btn" class:active={reposted} onclick={toggleRepost} disabled={reposting} aria-label="Repost">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
				</svg>
				{repostCount}
			</button>
			<a class="action-btn comment-btn" href="/post/{post.id}" aria-label="Comments">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
				</svg>
				{post.commentCount ?? 0}
			</a>
		</div>
		<div class="footer-meta">
			<span class="date">{timeAgo(post.created_at)}</span>
			<button class="share-btn" class:share-copied={shared} onclick={share}>
				{#if shared}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
					Copied
				{:else}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
					Share
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.post-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		background: var(--color-surface);
		transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
	}

	.post-card:hover {
		border-color: var(--color-lilac);
		box-shadow: var(--shadow-card-hover);
		transform: translateY(-4px);
	}

	.post-card.featured {
		grid-column: 1 / -1;
		padding: 20px;
	}

	.featured-eyebrow {
		margin-bottom: -2px;
	}

	.post-card.featured .author-avatar {
		width: 48px;
		height: 48px;
	}

	.post-card.featured .preview {
		font-size: 1.3125rem;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	/* "X reposted this" banner */
	.repost-banner {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.repost-banner a {
		color: var(--color-text-strong);
		text-decoration: none;
	}

	.repost-banner a:hover {
		text-decoration: underline;
	}

	.card-link {
		display: flex;
		flex-direction: column;
		gap: 10px;
		text-decoration: none;
		color: var(--color-text);
		min-width: 0;
	}

	/* Author row */
	.author-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.author-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-primary-bright);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		flex-shrink: 0;
	}

	.author-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.author-avatar span {
		color: white;
		font-weight: 700;
		font-size: 0.9rem;
	}

	.author-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Thumbnails */
	.thumb-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		max-width: 86%;
	}

	.thumb-grid.single {
		grid-template-columns: 1fr;
		max-width: 60%;
	}

	.thumb-grid img {
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 18px;
	}

	/* Tags — sit under the media/text, above the footer */
	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.card-tag {
		display: inline-flex;
		align-items: center;
		background: var(--color-primary-light);
		color: var(--color-primary-deep);
		border: none;
		border-radius: var(--radius-pill);
		padding: 4px 12px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		font-family: inherit;
	}

	.card-tag:hover {
		background: var(--color-lilac-soft);
	}

	/* Body preview — same display font/weight as the Discover tab's "Top
	   post" hero quote, just not scaled all the way up to hero size. */
	.preview {
		font-family: var(--font-display);
		font-size: 1.1875rem;
		line-height: 1.45;
		color: var(--color-text-body);
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.preview.muted {
		color: var(--color-text-muted);
		font-style: italic;
	}

	/* Footer */
	.post-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: auto;
	}

	.footer-actions {
		display: flex;
		align-items: center;
		gap: 20px;
		min-width: 0;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		padding: 0;
		font-size: 0.875rem;
		font-weight: 700;
		font-family: inherit;
		color: var(--color-text-muted);
		cursor: pointer;
		text-decoration: none;
		transition: color 0.15s;
	}

	.action-btn:disabled {
		cursor: default;
		opacity: 0.7;
	}

	.like-btn:hover,
	.like-btn.active {
		color: #f43f5e;
	}

	.repost-btn:hover,
	.repost-btn.active {
		color: #16a34a;
	}

	.comment-btn:hover {
		color: var(--color-primary-deep);
	}

	.footer-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.date {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.share-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		background: none;
		border: 1.5px solid var(--color-border-strong);
		border-radius: var(--radius-pill);
		padding: 7px 14px;
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}

	.share-btn:hover {
		border-color: var(--color-lilac);
		color: var(--color-primary-deep);
		background: var(--color-primary-light);
	}

	.share-btn.share-copied {
		border-color: #16a34a;
		color: #16a34a;
		background: #f0fdf4;
	}
</style>
