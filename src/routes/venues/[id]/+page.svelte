<script lang="ts">
	import VenueReviews from '$lib/components/VenueReviews.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const venue = $derived(data.venue);
</script>

<div class="venue-page">
	<a href="/venues" class="back-link">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 5l-7 7 7 7" />
		</svg>
		Back to Venues
	</a>

	<section class="card venue-hero">
		<div class="venue-hero-icon">
			<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
				<polyline points="9 22 9 12 15 12 15 22" />
			</svg>
		</div>
		<div class="venue-hero-info">
			<span class="unclaimed-badge">Unclaimed listing</span>
			<h1>{venue.name}</h1>
			{#if venue.address || venue.city}
				<p class="venue-location">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
					</svg>
					{[venue.address, venue.city].filter(Boolean).join(', ')}
				</p>
			{/if}
			{#if venue.venue_types?.length}
				<div class="venue-types">
					{#each venue.venue_types as t}<span class="venue-type">{t.replace(/_/g, ' ')}</span>{/each}
				</div>
			{/if}
			<div class="venue-contact">
				{#if venue.website}
					<a href={venue.website} target="_blank" rel="noopener">{venue.website.replace(/^https?:\/\//, '')}</a>
				{/if}
				{#if venue.phone}<span>{venue.phone}</span>{/if}
			</div>
			<a href="/venues/{venue.id}/claim" class="claim-btn">Claim this venue →</a>
		</div>
	</section>

	<section class="card">
		<h2 class="card-title">Reviews</h2>
		<VenueReviews seededVenueId={venue.id} currentUserId={data.user?.id ?? null} canReview={!!data.user} />
	</section>
</div>

<style>
	.venue-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 20px 20px 60px;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-decoration: none;
		width: fit-content;
	}

	.back-link:hover {
		color: var(--color-text);
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card-lg);
		box-shadow: var(--shadow-sm);
		padding: 28px;
	}

	.card-title {
		font-size: 1.375rem;
		font-weight: 800;
		font-family: var(--font-display);
		margin: 0 0 16px;
	}

	.venue-hero {
		display: flex;
		gap: 20px;
	}

	.venue-hero-icon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--color-bg);
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.venue-hero-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	.unclaimed-badge {
		align-self: flex-start;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--color-bg);
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
	}

	.venue-hero-info h1 {
		font-size: 1.75rem;
		font-weight: 800;
		font-family: var(--font-display);
		margin: 0;
	}

	.venue-location {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.venue-types {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.venue-type {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: capitalize;
		padding: 2px 10px;
		border-radius: 999px;
		background: var(--color-primary-light);
		color: var(--color-primary-deep);
	}

	.venue-contact {
		display: flex;
		gap: 14px;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.venue-contact a {
		color: var(--color-primary-deep);
		font-weight: 600;
		text-decoration: none;
	}

	.claim-btn {
		align-self: flex-start;
		margin-top: 6px;
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-pill);
		padding: 9px 18px;
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
		transition: background 0.15s;
	}

	.claim-btn:hover {
		background: var(--color-primary-dark);
	}

	@media (max-width: 560px) {
		.venue-hero {
			flex-direction: column;
		}
	}
</style>
