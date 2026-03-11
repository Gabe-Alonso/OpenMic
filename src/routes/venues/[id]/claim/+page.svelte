<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let fullName = $state('');
	let email = $state('');
	let role = $state('owner');
	let submitted = $state(false);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		submitted = true;
	}
</script>

<div class="claim-page">
	<div class="card">
		<a href="/venues" class="back-link">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M19 12H5M12 5l-7 7 7 7" />
			</svg>
			Back to Venues
		</a>

		{#if submitted}
			<div class="success-state">
				<div class="success-icon">✓</div>
				<h2>Request submitted!</h2>
				<p>We'll review your claim for <strong>{data.venue.name}</strong> and contact you within a few days.</p>
				<a href="/venues" class="done-btn">Back to Venues</a>
			</div>
		{:else}
			<div class="card-header">
				<span class="venue-label">Venue</span>
				<h1>Claim {data.venue.name}</h1>
				{#if data.venue.address || data.venue.city}
					<p class="venue-location">{[data.venue.address, data.venue.city].filter(Boolean).join(', ')}</p>
				{/if}
				<p class="desc">If you own or manage this venue, fill in your details below. We'll verify your claim and link it to your account.</p>
			</div>

			<form class="form" onsubmit={handleSubmit}>
				<div class="field">
					<label for="full-name">Your full name</label>
					<input id="full-name" type="text" placeholder="Jane Smith" bind:value={fullName} required />
				</div>

				<div class="field">
					<label for="email">Contact email</label>
					<input id="email" type="email" placeholder="you@example.com" bind:value={email} required />
				</div>

				<div class="field">
					<label>Your role</label>
					<div class="role-options">
						{#each [['owner', 'Owner'], ['manager', 'Manager'], ['representative', 'Representative']] as [val, label]}
							<label class="role-option" class:selected={role === val}>
								<input type="radio" name="role" value={val} bind:group={role} />
								{label}
							</label>
						{/each}
					</div>
				</div>

				<button type="submit" class="submit-btn" disabled={!fullName || !email}>
					Submit Claim Request
				</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.claim-page {
		min-height: 60vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: 40px 36px;
		width: 100%;
		max-width: 460px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		text-decoration: none;
		align-self: flex-start;
		transition: color 0.12s;
	}

	.back-link:hover { color: var(--color-text); }

	.card-header {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.venue-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.4px;
	}

	.venue-location {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.desc {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.5;
		margin-top: 4px;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	input[type='text'],
	input[type='email'] {
		width: 100%;
		padding: 10px 14px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		background: var(--color-bg);
		color: var(--color-text);
		transition: border-color 0.15s;
		outline: none;
		font-family: inherit;
	}

	input[type='text']:focus,
	input[type='email']:focus {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	input::placeholder { color: var(--color-text-muted); opacity: 0.7; }

	.role-options {
		display: flex;
		gap: 8px;
	}

	.role-option {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 9px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: border-color 0.12s, background 0.12s, color 0.12s;
		color: var(--color-text-muted);
		user-select: none;
	}

	.role-option input { display: none; }

	.role-option.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.submit-btn {
		width: 100%;
		padding: 11px;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
		margin-top: 4px;
	}

	.submit-btn:hover:not(:disabled) { background: var(--color-primary-dark); }
	.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Success state */
	.success-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
		padding: 8px 0;
	}

	.success-icon {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: #dcfce7;
		color: #16a34a;
		font-size: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
	}

	.success-state h2 { font-size: 1.3rem; font-weight: 700; }
	.success-state p { font-size: 0.9rem; color: var(--color-text-muted); line-height: 1.5; }

	.done-btn {
		display: inline-block;
		background: var(--color-primary);
		color: white;
		padding: 9px 24px;
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		font-weight: 600;
		margin-top: 4px;
		text-decoration: none;
		transition: background 0.15s;
	}

	.done-btn:hover { background: var(--color-primary-dark); }
</style>
