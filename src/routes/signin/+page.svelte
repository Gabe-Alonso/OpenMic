<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);

	function goBack() {
		history.back();
	}
</script>

<div class="signin-page">
	<div class="card">
		<div class="card-header">
			<span class="brand">OpenMic</span>
			<h1>Sign in</h1>
			<p>Welcome back. Connect with your community.</p>
		</div>

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
			{#if form?.error}
				<p class="error-msg">{form.error}</p>
			{/if}

			<div class="field">
				<label for="email">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					placeholder="you@example.com"
					autocomplete="email"
					value={form?.email ?? ''}
				/>
			</div>

			<div class="field">
				<div class="field-label-row">
					<label for="password">Password</label>
					<a href="/forgot-password" class="forgot">Forgot password?</a>
				</div>
				<input id="password" name="password" type="password" placeholder="••••••••" autocomplete="current-password" />
			</div>

			<button type="submit" class="submit-btn" disabled={loading}>
				{loading ? 'Signing in…' : 'Sign In'}
			</button>
		</form>

		<div class="divider"><span>or</span></div>

		<a href="/api/auth/google" class="google-btn">
			<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
				<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
				<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
				<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
				<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
			</svg>
			Continue with Google
		</a>

		<p class="signup-prompt">
			Don't have an account? <a href="/signup" class="signup-link">Sign up</a>
		</p>

		<button class="back-btn" onclick={goBack}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M19 12H5M12 5l-7 7 7 7" />
			</svg>
			Back
		</button>
	</div>
</div>

<style>
	.signin-page {
		min-height: 75vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: 40px 36px;
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.card-header {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.brand {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--color-primary);
		letter-spacing: -0.3px;
	}

	h1 {
		font-size: 1.6rem;
		font-weight: 700;
		letter-spacing: -0.5px;
	}

	.card-header p {
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.error-msg {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
		border-radius: var(--radius-sm);
		padding: 10px 14px;
		font-size: 0.875rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.forgot {
		font-size: 0.8rem;
		color: var(--color-primary);
	}

	.forgot:hover {
		text-decoration: underline;
	}

	input {
		width: 100%;
		padding: 10px 14px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		background: var(--color-bg);
		color: var(--color-text);
		transition: border-color 0.15s;
		outline: none;
	}

	input:focus {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.7;
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
		transition: background 0.15s;
		margin-top: 4px;
	}

	.submit-btn:hover:not(:disabled) {
		background: var(--color-primary-dark);
	}

	.submit-btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.signup-prompt {
		text-align: center;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.signup-link {
		color: var(--color-primary);
		font-weight: 500;
	}

	.signup-link:hover {
		text-decoration: underline;
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: 0.85rem;
		font-weight: 500;
		padding: 0;
		align-self: center;
		transition: color 0.15s;
	}

	.back-btn:hover {
		color: var(--color-text);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--color-text-muted);
		font-size: 0.8rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.google-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		padding: 11px;
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--color-text);
		text-decoration: none;
		transition: background 0.15s, border-color 0.15s;
	}

	.google-btn:hover {
		background: var(--color-bg);
		border-color: #9ca3af;
	}
</style>
