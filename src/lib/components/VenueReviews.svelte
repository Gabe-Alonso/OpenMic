<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { timeAgo } from '$lib/format';
	import StarRating from './StarRating.svelte';

	interface Props {
		venueProfileId?: string;
		seededVenueId?: string;
		currentUserId: string | null;
		canReview: boolean;
	}

	let { venueProfileId, seededVenueId, currentUserId, canReview }: Props = $props();

	const PREVIEW_COUNT = 3;
	// Fixed for the lifetime of this component instance — it's keyed per venue
	// page, not meant to follow a prop change mid-mount.
	const query = untrack(() =>
		venueProfileId ? `venue_profile_id=${venueProfileId}` : `seeded_venue_id=${seededVenueId}`
	);

	let loading = $state(true);
	let average = $state<number | null>(null);
	let count = $state(0);
	let reviews = $state<any[]>([]);
	let nextCursor = $state<string | null>(null);
	let expanded = $state(false);
	let loadingMore = $state(false);
	let myReview = $state<any>(null);

	let showForm = $state(false);
	let formRating = $state(0);
	let formComment = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);

	async function load() {
		loading = true;
		const res = await fetch(`/api/venue-ratings?${query}&limit=${PREVIEW_COUNT}`);
		if (res.ok) {
			const json = await res.json();
			average = json.average;
			count = json.count;
			reviews = json.reviews;
			nextCursor = json.nextCursor;
			myReview = json.myReview;
		}
		loading = false;
	}

	load();

	async function loadMore() {
		if (loadingMore) return;
		loadingMore = true;
		expanded = true;
		const res = await fetch(`/api/venue-ratings?${query}&limit=10${nextCursor ? `&cursor=${nextCursor}` : ''}`);
		if (res.ok) {
			const json = await res.json();
			reviews = [...reviews, ...json.reviews];
			nextCursor = json.nextCursor;
		}
		loadingMore = false;
	}

	function startReview() {
		if (!currentUserId) {
			goto('/signin');
			return;
		}
		formRating = myReview?.rating ?? 0;
		formComment = myReview?.comment ?? '';
		formError = null;
		showForm = true;
	}

	async function submitReview() {
		if (submitting || formRating <= 0) return;
		submitting = true;
		formError = null;
		const res = await fetch('/api/venue-ratings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				venue_profile_id: venueProfileId ?? null,
				seeded_venue_id: seededVenueId ?? null,
				rating: formRating,
				comment: formComment
			})
		});
		if (res.ok) {
			showForm = false;
			await load();
		} else {
			const json = await res.json();
			formError = json.error ?? 'Failed to submit review.';
		}
		submitting = false;
	}

	async function deleteMyReview() {
		if (!myReview) return;
		submitting = true;
		const res = await fetch(`/api/venue-ratings/${myReview.id}`, { method: 'DELETE' });
		if (res.ok) {
			showForm = false;
			await load();
		}
		submitting = false;
	}

	const roundedAverage = $derived(average != null ? Math.round(average * 2) / 2 : 0);
</script>

<div class="venue-reviews">
	{#if loading}
		<p class="reviews-status">Loading reviews…</p>
	{:else}
		<div class="rating-summary">
			<StarRating value={roundedAverage} size={22} />
			{#if average != null}
				<span class="rating-number">{average.toFixed(1)}</span>
				<span class="rating-count">({count} {count === 1 ? 'review' : 'reviews'})</span>
			{:else}
				<span class="rating-count">No reviews yet</span>
			{/if}
			{#if canReview}
				<button class="write-review-btn" onclick={startReview}>
					{myReview ? 'Edit your review' : 'Write a review'}
				</button>
			{/if}
		</div>

		{#if showForm}
			<div class="review-form">
				<StarRating value={formRating} interactive size={26} onrate={(v) => (formRating = v)} />
				{#if formRating > 0}<span class="form-rating-label">{formRating} / 5</span>{/if}
				<textarea
					bind:value={formComment}
					placeholder="Share your experience at this venue… (optional)"
					rows="3"
					maxlength="2000"
				></textarea>
				{#if formError}<p class="form-error">{formError}</p>{/if}
				<div class="review-form-actions">
					{#if myReview}
						<button class="btn-ghost" onclick={deleteMyReview} disabled={submitting}>Delete review</button>
					{/if}
					<button class="btn-ghost" onclick={() => (showForm = false)} disabled={submitting}>Cancel</button>
					<button class="btn-primary" onclick={submitReview} disabled={submitting || formRating <= 0}>
						{submitting ? 'Saving…' : 'Submit'}
					</button>
				</div>
			</div>
		{/if}

		{#if reviews.length === 0}
			<p class="reviews-status">Be the first to leave a review.</p>
		{:else}
			<div class="review-list">
				{#each reviews as r (r.id)}
					<div class="review-item">
						<div class="review-avatar">
							{#if r.reviewer?.avatar_url}
								<img src={r.reviewer.avatar_url} alt={r.reviewer.full_name ?? ''} />
							{:else}
								<span>{(r.reviewer?.full_name ?? '?')[0]?.toUpperCase()}</span>
							{/if}
						</div>
						<div class="review-body">
							<div class="review-meta">
								<span class="review-author">{r.reviewer?.full_name ?? 'Anonymous'}</span>
								<StarRating value={Number(r.rating)} size={13} />
								<span class="review-time">{timeAgo(r.created_at)}</span>
							</div>
							{#if r.comment}<p class="review-comment">{r.comment}</p>{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if !expanded && count > PREVIEW_COUNT}
			<button class="see-all-link" onclick={loadMore}>See all {count} reviews →</button>
		{:else if nextCursor}
			<button class="see-all-link" onclick={loadMore} disabled={loadingMore}>
				{loadingMore ? 'Loading…' : 'Load more reviews'}
			</button>
		{/if}
	{/if}
</div>

<style>
	.venue-reviews {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.reviews-status {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.rating-summary {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.rating-number {
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--color-text);
	}

	.rating-count {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.write-review-btn {
		margin-left: auto;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-pill);
		padding: 7px 16px;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
	}

	.write-review-btn:hover {
		background: var(--color-primary-dark);
	}

	.review-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.form-rating-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.review-form textarea {
		padding: 9px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--color-text);
		background: var(--color-surface);
		resize: vertical;
	}

	.form-error {
		font-size: 0.8rem;
		color: var(--color-danger);
		margin: 0;
	}

	.review-form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.btn-ghost {
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-pill);
		padding: 7px 14px;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-pill);
		padding: 7px 16px;
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-ghost:disabled,
	.btn-primary:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.review-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.review-item {
		display: flex;
		gap: 10px;
	}

	.review-avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--color-primary-bright);
		color: white;
		font-weight: 700;
		font-size: 0.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		flex-shrink: 0;
	}

	.review-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.review-body {
		flex: 1;
		min-width: 0;
	}

	.review-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.review-author {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.review-time {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.review-comment {
		font-size: 0.875rem;
		color: var(--color-text-body);
		margin: 4px 0 0;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.see-all-link {
		align-self: flex-start;
		background: none;
		border: none;
		color: var(--color-primary-deep);
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		padding: 0;
	}

	.see-all-link:hover {
		text-decoration: underline;
	}
</style>
