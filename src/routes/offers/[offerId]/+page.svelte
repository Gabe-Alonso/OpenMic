<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const event = data.offer.slot?.event ?? null;
	const venue = event?.venue ?? null;

	function formatTime(t: string | null): string {
		if (!t) return '';
		const [h, m] = t.split(':').map(Number);
		const period = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 === 0 ? 12 : h % 12;
		return `${h12}:${String(m).padStart(2, '0')} ${period}`;
	}
</script>

<div class="offer-page">
	<div class="card">
		{#if form?.decided}
			<div class="decided-state">
				{#if form.accepted}
					<h1>You're booked!</h1>
					<p>You accepted the invitation to perform at <strong>{event?.title}</strong>. The slot is locked in.</p>
				{:else}
					<h1>Invitation declined</h1>
					<p>You declined the invitation to perform at <strong>{event?.title}</strong>.</p>
				{/if}
				{#if event}
					<a href="/profile/{event.profile_id}" class="btn btn-primary">View venue</a>
				{/if}
			</div>
		{:else if data.offer.status !== 'pending'}
			<div class="decided-state">
				<h1>This invitation has already been decided</h1>
				<p>Status: <strong>{data.offer.status}</strong></p>
				{#if event}
					<a href="/profile/{event.profile_id}" class="btn btn-primary">View venue</a>
				{/if}
			</div>
		{:else}
			<span class="eyebrow">Private invitation</span>
			<h1>{venue?.full_name ?? 'A venue'} invited you to perform</h1>
			{#if event}
				<p class="event-summary">
					<strong>{event.title}</strong> on {event.date}
					{#if data.offer.slot?.start_time}
						&middot; {formatTime(data.offer.slot.start_time)}{data.offer.slot.end_time ? `–${formatTime(data.offer.slot.end_time)}` : ''}
					{/if}
				</p>
			{/if}
			{#if data.offer.message}
				<p class="offer-message">"{data.offer.message}"</p>
			{/if}

			{#if form && 'offerError' in form && form.offerError}
				<p class="error-banner" role="alert">{form.offerError}</p>
			{/if}

			<div class="offer-actions">
				<form method="POST" action="?/accept" use:enhance>
					<button type="submit" class="btn btn-primary">Accept</button>
				</form>
				<form method="POST" action="?/decline" use:enhance>
					<button type="submit" class="btn btn-secondary">Decline</button>
				</form>
			</div>
		{/if}
	</div>
</div>

<style>
	.offer-page {
		max-width: 560px;
		margin: 0 auto;
		padding: 40px 20px;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		padding: 32px;
	}

	.eyebrow {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-primary);
	}

	h1 {
		margin: 6px 0 12px;
		font-size: 1.75rem;
	}

	.event-summary {
		color: var(--color-text-strong);
		margin: 0 0 12px;
	}

	.offer-message {
		background: var(--color-bg);
		border-radius: var(--radius-md);
		padding: 12px 14px;
		font-style: italic;
		color: var(--color-text-strong);
		margin: 0 0 20px;
	}

	.offer-actions {
		display: flex;
		gap: 12px;
	}

	.error-banner {
		background: var(--color-danger-bg);
		color: var(--color-danger);
		border: 1px solid var(--color-danger-border);
		border-radius: var(--radius-md);
		padding: 10px 14px;
		font-size: 0.85rem;
		margin: 0 0 12px;
	}

	.decided-state {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.decided-state .btn {
		align-self: flex-start;
		margin-top: 6px;
	}
</style>
