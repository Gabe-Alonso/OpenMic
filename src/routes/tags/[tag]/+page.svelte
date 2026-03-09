<script lang="ts">
	import PostCard from '$lib/components/PostCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="tag-page">
	<div class="tag-header">
		<a href="/" class="back-link">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
			Back
		</a>
		<div class="tag-title">
			<span class="tag-badge">#{data.tag}</span>
			<span class="tag-count">{data.posts.length} post{data.posts.length === 1 ? '' : 's'}</span>
		</div>
	</div>

	{#if data.posts.length === 0}
		<div class="empty-state">
			<p>No posts tagged <strong>#{data.tag}</strong> yet.</p>
		</div>
	{:else}
		<div class="posts-grid">
			{#each data.posts as post (post.id)}
				<PostCard {post} likeCount={data.likeCounts[post.id] ?? 0} showAuthor={true} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.tag-page {
		max-width: 900px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.tag-header {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		text-decoration: none;
		transition: color 0.15s;
		flex-shrink: 0;
	}

	.back-link:hover {
		color: var(--color-text);
	}

	.tag-title {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.tag-badge {
		font-size: 1.4rem;
		font-weight: 800;
		color: var(--color-primary);
		letter-spacing: -0.5px;
	}

	.tag-count {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: var(--color-text-muted);
		font-size: 0.95rem;
	}

	.posts-grid {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
</style>
