<script lang="ts">
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

		<form class="form">
			<div class="field">
				<label for="email">Email</label>
				<input id="email" type="email" placeholder="you@example.com" autocomplete="email" />
			</div>

			<div class="field">
				<div class="field-label-row">
					<label for="password">Password</label>
					<a href="/forgot-password" class="forgot">Forgot password?</a>
				</div>
				<input id="password" type="password" placeholder="••••••••" autocomplete="current-password" />
			</div>

			<button type="submit" class="submit-btn">Sign In</button>
		</form>

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

	.submit-btn:hover {
		background: var(--color-primary-dark);
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
</style>
