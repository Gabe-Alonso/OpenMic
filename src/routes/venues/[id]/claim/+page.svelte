<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let role = $state('owner');
	let submitting = $state(false);
</script>

<div class="claim-page">
	<a href="/venues/{data.venue.id}" class="back-link">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 5l-7 7 7 7" />
		</svg>
		Back to {data.venue.name}
	</a>

	<div class="auth-layout">
		<div class="brand-panel">
			<div class="brand-ring-a" aria-hidden="true"></div>
			<div class="brand-ring-b" aria-hidden="true"></div>
			<div class="brand-blob" aria-hidden="true"></div>

			<div class="brand-top">
				<span class="eyebrow">Venue</span>
				<h1>Claim {data.venue.name}</h1>
				{#if data.venue.address || data.venue.city}
					<span class="venue-location">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
						{[data.venue.address, data.venue.city].filter(Boolean).join(', ')}
					</span>
				{/if}
			</div>

			<ol class="steps">
				<li>
					<span class="step-num step-num-filled">1</span>
					Tell us your role
				</li>
				<li>
					<span class="step-num">2</span>
					{data.venue.website
						? 'Instant approval if your email matches the venue\'s website domain'
						: 'We review your claim'}
				</li>
				<li>
					<span class="step-num">3</span>
					It's linked to your account
				</li>
			</ol>
		</div>

		<div class="card claim-card">
			{#if form?.claimSubmitted}
				<div class="success-state">
					<div class="success-icon">
						<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
					</div>
					{#if form.approved}
						<h2>You're verified!</h2>
						<p>Your email matched <strong>{data.venue.name}</strong>'s listed website, so your claim was approved instantly. You can now manage this venue's page.</p>
					{:else}
						<h2>Request submitted!</h2>
						<p>We'll review your claim for <strong>{data.venue.name}</strong> and get back to you.</p>
					{/if}
					<a href="/venues/{data.venue.id}" class="btn btn-primary done-btn">View venue</a>
				</div>
			{:else if data.venue.claimed_profile_id}
				<div class="info-state">
					<p>This venue has already been claimed.</p>
					<a href="/venues/{data.venue.id}" class="btn btn-primary done-btn">View venue</a>
				</div>
			{:else if !data.signedIn}
				<div class="info-state">
					<p>Sign in to claim this venue.</p>
					<a href="/signin" class="btn btn-primary done-btn">Sign in</a>
				</div>
			{:else if data.myClaim?.status === 'pending'}
				<div class="info-state">
					<p>Your claim on <strong>{data.venue.name}</strong> is pending review. We'll let you know once it's decided.</p>
					<a href="/venues/{data.venue.id}" class="btn btn-primary done-btn">View venue</a>
				</div>
			{:else}
				{#if data.myClaim?.status === 'rejected'}
					<p class="rejected-note">Your previous claim on this venue wasn't approved. You're welcome to submit again if your situation has changed.</p>
				{/if}
				{#if form?.claimError}
					<p class="error-banner" role="alert">{form.claimError}</p>
				{/if}
				<form class="form" method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }}>
					<p class="desc">If you own or manage this venue, let us know your role below.</p>

					<div class="form-field">
						<span id="role-label">Your role</span>
						<div class="role-options" role="radiogroup" aria-labelledby="role-label">
							{#each [['owner', 'Owner'], ['manager', 'Manager'], ['representative', 'Representative']] as [val, label]}
								<label class="role-option" class:selected={role === val}>
									<input type="radio" name="role" value={val} bind:group={role} />
									{label}
								</label>
							{/each}
						</div>
					</div>

					<div class="form-field">
						<label for="note">Anything else we should know? (optional)</label>
						<div class="field">
							<textarea id="note" name="note" rows="3" placeholder="e.g. how you're connected to this venue" maxlength="1000"></textarea>
						</div>
					</div>

					<button type="submit" class="btn btn-primary submit-btn" disabled={submitting}>
						{submitting ? 'Submitting…' : 'Submit Claim Request'}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>

<style>
	.claim-page {
		min-height: 60vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		padding: 24px 20px;
	}

	.back-link {
		align-self: center;
		width: 100%;
		max-width: 920px;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-decoration: none;
		min-height: 44px;
		transition: color 0.12s;
	}

	.back-link:hover { color: var(--color-text); }

	.auth-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		max-width: 920px;
		width: 100%;
		border-radius: var(--radius-panel);
		overflow: hidden;
		box-shadow: 0 24px 60px rgba(76, 29, 149, 0.12);
	}

	.brand-panel {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 48px;
		padding: 44px;
		background: var(--color-ink);
		color: var(--color-cream);
	}

	.brand-ring-a {
		position: absolute;
		right: -120px;
		top: -120px;
		width: 380px;
		height: 380px;
		border-radius: 50%;
		border: 1px solid rgba(196, 181, 253, 0.25);
	}

	.brand-ring-b {
		position: absolute;
		right: -50px;
		top: -50px;
		width: 240px;
		height: 240px;
		border-radius: 50%;
		border: 1px solid rgba(196, 181, 253, 0.35);
	}

	.brand-blob {
		position: absolute;
		right: 24px;
		top: 24px;
		width: 90px;
		height: 90px;
		border-radius: 50%;
		background: var(--color-primary);
		opacity: 0.6;
	}

	.brand-top {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.brand-top .eyebrow {
		color: var(--color-lilac-bright);
	}

	.brand-top h1 {
		margin: 0;
		font-size: clamp(2rem, 4.4vw, 3.25rem);
		line-height: 1;
		color: var(--color-cream);
	}

	.venue-location {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9375rem;
		color: var(--color-lilac-soft);
	}

	.steps {
		position: relative;
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.steps li {
		display: flex;
		align-items: center;
		gap: 14px;
		font-size: 1rem;
		font-weight: 500;
		color: var(--color-lilac-soft);
	}

	.step-num {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1.5px solid rgba(196, 181, 253, 0.5);
		color: var(--color-lilac-soft);
		font-weight: 700;
		font-size: 0.875rem;
	}

	.step-num-filled {
		background: var(--color-cream);
		border-color: var(--color-cream);
		color: var(--color-ink);
	}

	.claim-card {
		border-radius: 0;
		border: none;
		box-shadow: none;
		padding: 44px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.desc {
		font-size: 1rem;
		color: var(--color-text-strong);
		line-height: 1.6;
		margin: 0 0 4px;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label,
	#role-label {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.field textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.9rem;
		font-family: inherit;
		color: var(--color-text);
		background: var(--color-surface);
		resize: vertical;
	}

	.role-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(130px, 100%), 1fr));
		gap: 8px;
	}

	.role-option {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 48px;
		padding: 0 12px;
		border: 1.5px solid var(--color-border-strong);
		border-radius: 14px;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.12s, background 0.12s, color 0.12s;
		color: var(--color-text-strong);
		user-select: none;
	}

	.role-option input { display: none; }

	.role-option.selected {
		border-color: var(--color-ink);
		background: var(--color-ink);
		color: var(--color-cream);
	}

	.submit-btn {
		width: 100%;
		margin-top: 4px;
	}

	.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.error-banner {
		background: var(--color-danger-bg);
		color: var(--color-danger);
		border: 1px solid var(--color-danger-border);
		border-radius: var(--radius-md);
		padding: 10px 14px;
		font-size: 0.85rem;
		margin: 0 0 4px;
	}

	.rejected-note {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		background: var(--color-bg);
		border-radius: var(--radius-md);
		padding: 10px 14px;
		margin: 0 0 4px;
	}

	/* Info / success states */
	.info-state,
	.success-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
		padding: 24px 0;
	}

	.info-state p {
		font-size: 1rem;
		color: var(--color-text-strong);
		line-height: 1.6;
		max-width: 360px;
	}

	.success-icon {
		width: 80px;
		height: 80px;
		border-radius: 28px;
		background: var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 14px 30px rgba(109, 40, 217, 0.35);
	}

	.success-state h2 { font-size: 2.25rem; margin: 0; }
	.success-state p { font-size: 1rem; max-width: 360px; color: var(--color-text-strong); line-height: 1.6; }

	.done-btn {
		margin-top: 8px;
	}

	@media (max-width: 760px) {
		.auth-layout {
			grid-template-columns: 1fr;
			border-radius: var(--radius-card);
		}

		.claim-card {
			border-radius: var(--radius-card);
			padding: 36px 28px;
		}

		.brand-panel {
			padding: 36px 28px;
		}
	}
</style>
