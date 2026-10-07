<script lang="ts">
	import { untrack } from 'svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let posts = $state<any[]>(untrack(() => data.posts));
	let likeCounts = $state<Record<string, number>>(untrack(() => data.likeCounts));
	let cursor = $state<string | null>(untrack(() => data.nextCursor));
	let loadingMore = $state(false);

	async function loadMore() {
		if (!cursor || loadingMore) return;
		loadingMore = true;
		const res = await fetch(`/api/tags/${data.tag}?cursor=${encodeURIComponent(cursor)}`);
		if (res.ok) {
			const json = await res.json();
			posts = [...posts, ...(json.posts ?? [])];
			likeCounts = { ...likeCounts, ...(json.likeCounts ?? {}) };
			cursor = json.nextCursor ?? null;
		}
		loadingMore = false;
	}
</script>

<div class="tag-page">
	<a href="/" class="back-link">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
		Back
	</a>

	<div class="tag-hero">
		<div class="hero-ring-a" aria-hidden="true"></div>
		<div class="hero-ring-b" aria-hidden="true"></div>
		<div class="tag-heading">
			<span class="eyebrow tag-eyebrow">Tag</span>
			<h1 class="tag-badge">#<span class="accent">{data.tag}</span></h1>
		</div>
		<p class="tag-count">{posts.length} post{posts.length === 1 ? '' : 's'}</p>
	</div>

	{#if posts.length === 0}
		<div class="empty-state">
			<span class="empty-hash">#</span>
			<h2 class="empty-title">No posts tagged #{data.tag} yet</h2>
			<p class="empty-sub">Be the first to share something with this tag.</p>
			<a href="/post/new" class="btn btn-primary">New Post</a>
		</div>
	{:else}
		<div class="posts-grid">
			{#each posts as post (post.id)}
				<PostCard {post} likeCount={likeCounts[post.id] ?? 0} showAuthor={true} />
			{/each}
		</div>
		{#if cursor}
			<button class="load-more-btn" onclick={loadMore} disabled={loadingMore}>
				{loadingMore ? 'Loading…' : 'Load more'}
			</button>
		{/if}
	{/if}
</div>

<style>
	.tag-page {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.back-link {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-decoration: none;
		transition: color 0.15s;
	}

	.back-link:hover {
		color: var(--color-text);
	}

	.tag-hero {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px;
		padding: 44px 48px;
		border-radius: var(--radius-panel);
		background: var(--color-panel);
		color: white;
	}

	.hero-ring-a {
		position: absolute;
		right: -90px;
		top: -110px;
		width: 360px;
		height: 360px;
		border-radius: 50%;
		border: 1.5px solid rgba(196, 181, 253, 0.22);
		pointer-events: none;
	}

	.hero-ring-b {
		position: absolute;
		right: 10px;
		top: -10px;
		width: 200px;
		height: 200px;
		border-radius: 50%;
		border: 1.5px solid rgba(196, 181, 253, 0.16);
		pointer-events: none;
	}

	.tag-heading {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}

	.tag-eyebrow {
		align-self: flex-start;
		color: var(--color-lilac-soft);
	}

	.tag-badge {
		margin: 0;
		font-size: clamp(2.5rem, 7vw, 4.5rem);
		line-height: 1;
		letter-spacing: -0.035em;
		color: white;
		overflow-wrap: anywhere;
	}

	.tag-badge .accent {
		color: var(--color-lilac);
	}

	.tag-count {
		position: relative;
		margin: 0;
		padding: 10px 18px;
		border-radius: var(--radius-pill);
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(196, 181, 253, 0.25);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-lilac-soft);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
		padding: 72px 24px;
		background: var(--color-surface);
		border: 1.5px dashed var(--color-border-strong);
		border-radius: var(--radius-card-lg);
	}

	.empty-hash {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 3.5rem;
		line-height: 1;
		color: var(--color-lilac);
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
		line-height: 1.6;
		margin: 0;
	}

	.posts-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 20px;
	}

	@media (max-width: 720px) {
		.tag-hero {
			padding: 32px 28px;
			border-radius: var(--radius-card-lg);
		}

		.posts-grid {
			grid-template-columns: 1fr;
		}
	}

	.load-more-btn {
		align-self: center;
		margin: 8px auto 0;
		display: block;
		min-height: 44px;
		padding: 0 28px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		border: 1.5px solid var(--color-border-strong);
		color: var(--color-text-strong);
		font-size: 0.875rem;
		font-weight: 700;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}

	.load-more-btn:hover:not(:disabled) {
		border-color: var(--color-lilac);
		color: var(--color-primary-deep);
		background: var(--color-primary-light);
	}

	.load-more-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
