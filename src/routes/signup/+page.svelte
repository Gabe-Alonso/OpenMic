<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);

	function goBack() {
		history.back();
	}
</script>

<div class="signup-page">
	<div class="auth-layout">
		<div class="brand-panel">
			<div class="brand-dots" aria-hidden="true"></div>
			<div class="brand-ring-a" aria-hidden="true"></div>
			<div class="brand-ring-b" aria-hidden="true"></div>
			<div class="brand-blob" aria-hidden="true"></div>

			<div class="brand-logo">
				<img src="/openmic.jpg" alt="OpenMic" />
			</div>

			<div class="brand-copy">
				<h2>Join the community.</h2>
				<p>Artists and venues, finding each other and finding stages.</p>
			</div>
		</div>

		<div class="card auth-card">
			{#if form?.success}
				<div class="success-state">
					<div class="success-icon">
						<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
					</div>
					<h2>Check your email</h2>
					<p>We sent a confirmation link to your inbox. Click it to activate your account.</p>
					<a href="/signin" class="btn btn-primary signin-link-btn">Go to Sign In</a>
				</div>
			{:else}
				<form
					class="form"
					method="POST"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							loading = false;
							await update();
						};
					}}
				>
					<div class="card-header">
						<h1>Create an account</h1>
						<p>Join the community of artists and venues.</p>
					</div>

					{#if form?.error}
						<p class="error-banner" role="alert">{form.error}</p>
					{/if}

					<div class="form-field">
						<label for="name">Full name</label>
						<div class="field">
							<input id="name" name="name" type="text" placeholder="Your name" autocomplete="name" value={form?.name ?? ''} />
						</div>
					</div>

					<div class="form-field">
						<label for="email">Email</label>
						<div class="field">
							<input id="email" name="email" type="email" placeholder="you@example.com" autocomplete="email" value={form?.email ?? ''} />
						</div>
					</div>

					<div class="form-field">
						<label for="password">Password</label>
						<div class="field">
							<input id="password" name="password" type="password" placeholder="••••••••" autocomplete="new-password" />
						</div>
					</div>

					<div class="form-field">
						<label for="confirm-password">Confirm password</label>
						<div class="field">
							<input id="confirm-password" name="confirm-password" type="password" placeholder="••••••••" autocomplete="new-password" />
						</div>
					</div>

					<button type="submit" class="btn btn-primary submit-btn" disabled={loading}>
						{loading ? 'Creating account…' : 'Create Account'}
					</button>

					<div class="divider"><span>or</span></div>

					<a href="/api/auth/google" class="btn btn-outline google-btn">
						<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
							<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
							<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
							<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
						</svg>
						Continue with Google
					</a>

					<p class="signin-prompt">
						Already have an account? <a href="/signin" class="signin-link">Sign in</a>
					</p>

					<button type="button" class="back-btn" onclick={goBack}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M19 12H5M12 5l-7 7 7 7" />
						</svg>
						Back
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>

<style>
	.signup-page {
		min-height: 75vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 0;
	}

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
		align-items: flex-start;
		justify-content: space-between;
		gap: 40px;
		padding: 44px;
		background: var(--color-ink);
		color: var(--color-cream);
		min-height: 560px;
	}

	.brand-dots {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
		background-size: 26px 26px;
	}

	.brand-ring-a {
		position: absolute;
		left: -140px;
		bottom: -160px;
		width: 460px;
		height: 460px;
		border-radius: 50%;
		border: 1px solid rgba(196, 181, 253, 0.25);
	}

	.brand-ring-b {
		position: absolute;
		left: -60px;
		bottom: -80px;
		width: 300px;
		height: 300px;
		border-radius: 50%;
		border: 1px solid rgba(196, 181, 253, 0.35);
	}

	.brand-blob {
		position: absolute;
		right: -90px;
		top: -90px;
		width: 300px;
		height: 300px;
		border-radius: 50%;
		background: var(--color-primary);
		opacity: 0.5;
	}

	.brand-logo {
		position: relative;
		width: 168px;
		height: 168px;
		border-radius: var(--radius-card-lg);
		background: var(--color-cream);
		overflow: hidden;
		transform: rotate(-4deg);
		box-shadow: 0 30px 60px rgba(8, 2, 22, 0.5), 0 0 0 8px rgba(246, 241, 231, 0.08);
	}

	.brand-logo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.brand-copy {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.brand-copy h2 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 2.875rem);
		line-height: 1.02;
		color: var(--color-cream);
	}

	.brand-copy p {
		margin: 0;
		max-width: 340px;
		font-size: 1.0625rem;
		line-height: 1.55;
		color: var(--color-lilac-soft);
	}

	.auth-card {
		border-radius: 0;
		border: none;
		box-shadow: none;
		padding: 48px 44px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.card-header {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 4px;
	}

	h1 {
		font-size: 2.5rem;
		line-height: 1;
	}

	.card-header p {
		font-size: 1rem;
		color: var(--color-text-muted);
	}

	.success-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
		padding: 24px 0;
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

	.success-state h2 {
		font-size: 2.25rem;
		margin: 0;
	}

	.success-state p {
		font-size: 1rem;
		max-width: 340px;
		color: var(--color-text-strong);
		line-height: 1.6;
	}

	.signin-link-btn {
		margin-top: 8px;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.submit-btn {
		width: 100%;
		margin-top: 4px;
	}

	.submit-btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.signin-prompt {
		text-align: center;
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.signin-link {
		color: var(--color-primary-dark);
		font-weight: 700;
	}

	.signin-link:hover {
		text-decoration: underline;
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		font-weight: 600;
		padding: 0;
		align-self: flex-start;
		transition: color 0.15s;
	}

	.back-btn:hover {
		color: var(--color-text);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 16px;
		color: var(--color-text-faint);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.google-btn {
		width: 100%;
		height: 54px;
	}

	@media (max-width: 760px) {
		.auth-layout {
			grid-template-columns: 1fr;
			max-width: 420px;
			border-radius: var(--radius-card);
		}

		.brand-panel {
			display: none;
		}

		.auth-card {
			border-radius: var(--radius-card);
			padding: 40px 32px;
		}
	}
</style>
