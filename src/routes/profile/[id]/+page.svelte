<script lang="ts">
	import PostCard from '$lib/components/PostCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const profile = $derived(data.profile);

	function getInitial(): string {
		const name = profile?.full_name || profile?.id;
		return name?.[0]?.toUpperCase() ?? '?';
	}
</script>

<div class="public-profile">

	<div class="card">
		<div class="profile-header">
			<div class="avatar-wrap">
				{#if profile.avatar_url}
					<img src={profile.avatar_url} alt={profile.full_name ?? 'Profile'} class="avatar-img" />
				{:else}
					<div class="avatar-circle">{getInitial()}</div>
				{/if}
			</div>

			<div class="header-info">
				<h1 class="display-name">{profile.full_name ?? 'Anonymous Artist'}</h1>
				{#if profile.location}
					<p class="location">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z" />
							<circle cx="12" cy="10" r="3" />
						</svg>
						{profile.location}
					</p>
				{/if}
			</div>
		</div>

		{#if profile.bio}
			<div class="section">
				<h2 class="section-title">About</h2>
				<p class="bio">{profile.bio}</p>
			</div>
		{/if}

		{#if profile.contact_email || profile.instagram}
			<div class="section">
				<h2 class="section-title">Contact</h2>
				<div class="contact-list">
					{#if profile.contact_email}
						<a href="mailto:{profile.contact_email}" class="contact-item">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect width="20" height="16" x="2" y="4" rx="2" />
								<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
							</svg>
							{profile.contact_email}
						</a>
					{/if}
					{#if profile.instagram}
						<a href="https://instagram.com/{profile.instagram}" target="_blank" rel="noopener noreferrer" class="contact-item">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
								<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
								<line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
							</svg>
							@{profile.instagram}
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<div class="card">
		<h2 class="card-title">Posts</h2>
		{#if data.posts.length > 0}
			<div class="posts-list">
				{#each data.posts as post}
					<PostCard {post} likeCount={data.likeCounts[post.id] ?? 0} />
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<span class="empty-icon">🎵</span>
				<p class="empty-title">Nothing here yet</p>
				<p class="empty-sub">This artist hasn't posted anything yet.</p>
			</div>
		{/if}
	</div>

</div>

<style>
	.public-profile {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 32px;
		box-shadow: var(--shadow-sm);
	}

	/* Header */
	.profile-header {
		display: flex;
		align-items: center;
		gap: 24px;
		margin-bottom: 28px;
	}

	.avatar-wrap {
		flex-shrink: 0;
	}

	.avatar-img {
		width: 88px;
		height: 88px;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-circle {
		width: 88px;
		height: 88px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		font-size: 2rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.display-name {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.4px;
		margin: 0;
	}

	.location {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Sections */
	.section {
		padding-top: 24px;
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.section + .section {
		margin-top: 0;
	}

	.section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.bio {
		font-size: 0.9rem;
		line-height: 1.65;
		color: var(--color-text);
		white-space: pre-wrap;
		margin: 0;
	}

	/* Contact */
	.contact-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.contact-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.875rem;
		color: var(--color-primary);
		text-decoration: none;
		width: fit-content;
	}

	.contact-item:hover {
		text-decoration: underline;
	}

	/* Posts */
	.posts-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.card-title {
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.3px;
		margin-bottom: 24px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 40px 0;
		text-align: center;
	}

	.empty-icon {
		font-size: 2rem;
		margin-bottom: 4px;
	}

	.empty-title {
		font-size: 1rem;
		font-weight: 600;
	}

	.empty-sub {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		max-width: 340px;
		line-height: 1.5;
	}
</style>
