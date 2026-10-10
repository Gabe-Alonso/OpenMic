<script lang="ts">
	import { untrack } from 'svelte';
	import { timeAgo } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let claims = $state(untrack(() => data.claims));
	let busyId = $state<string | null>(null);

	async function act(claimId: string, action: 'approve' | 'reject') {
		if (busyId) return;
		busyId = claimId;
		const res = await fetch(`/api/admin/venue-claims/${claimId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action })
		});
		if (res.ok) {
			claims = claims.filter((c: any) => c.id !== claimId);
		}
		busyId = null;
	}
</script>

<div class="admin-claims">
	<h1>Venue claims</h1>
	<p class="subtitle">{claims.length} pending {claims.length === 1 ? 'claim' : 'claims'}</p>

	{#if claims.length === 0}
		<p class="empty">Nothing waiting for review.</p>
	{:else}
		<div class="claim-list">
			{#each claims as claim (claim.id)}
				{@const venue = claim.venue as any}
				{@const claimant = claim.claimant as any}
				<div class="claim-card">
					<div class="claim-meta">
						<span class="role-pill">{claim.role}</span>
						<span class="meta-text">
							{claimant?.full_name ?? 'Unknown'} · {timeAgo(claim.created_at)}
						</span>
					</div>

					{#if claim.note}
						<p class="note">"{claim.note}"</p>
					{/if}

					<div class="venue-preview">
						<span class="venue-name">{venue?.name ?? 'Unknown venue'}</span>
						{#if venue?.address || venue?.city}
							<p class="venue-location">{[venue?.address, venue?.city].filter(Boolean).join(', ')}</p>
						{/if}
						{#if venue?.website}
							<a href={venue.website} target="_blank" rel="noopener" class="venue-website">{venue.website}</a>
						{:else}
							<span class="no-website">No website on file — can't auto-verify by domain match.</span>
						{/if}
						{#if venue}
							<a href="/venues/{venue.id}" target="_blank" class="view-link">View venue →</a>
						{/if}
					</div>

					<div class="actions">
						<button class="btn-ghost" disabled={busyId === claim.id} onclick={() => act(claim.id, 'reject')}>
							Reject
						</button>
						<button class="btn-primary" disabled={busyId === claim.id} onclick={() => act(claim.id, 'approve')}>
							{busyId === claim.id ? 'Saving…' : 'Approve'}
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.admin-claims {
		max-width: 760px;
		margin: 0 auto;
		padding: 32px 20px;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.subtitle {
		color: var(--color-text-muted);
		font-size: 0.9rem;
		margin: 4px 0 24px;
	}

	.empty {
		color: var(--color-text-muted);
		font-style: italic;
	}

	.claim-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.claim-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		background: var(--color-surface);
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.claim-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.role-pill {
		background: var(--color-primary-light);
		color: var(--color-primary-deep);
		border-radius: var(--radius-pill);
		padding: 3px 12px;
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: capitalize;
	}

	.meta-text {
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.note {
		font-size: 0.875rem;
		color: var(--color-text);
		background: var(--color-bg);
		border-radius: var(--radius-md);
		padding: 8px 12px;
		margin: 0;
	}

	.venue-preview {
		border-left: 3px solid var(--color-border-strong);
		padding-left: 12px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.venue-name {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.venue-location {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.venue-website {
		font-size: 0.8rem;
		color: var(--color-primary-deep);
		font-weight: 600;
	}

	.no-website {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.view-link {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-primary-deep);
		margin-top: 2px;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
		justify-content: flex-end;
		margin-top: 4px;
	}

	.btn-ghost {
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-pill);
		padding: 7px 16px;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.btn-ghost:hover:not(:disabled) {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-pill);
		padding: 7px 16px;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.88;
	}

	.btn-ghost:disabled,
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
