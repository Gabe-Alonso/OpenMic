<script lang="ts">
	function goBack() {
		history.back();
	}
</script>

<div class="signup-page">
	<div class="card">
		<div class="card-header">
			<span class="brand">OpenMic</span>
			<h1>Create an account</h1>
			<p>Join the community of artists and venues.</p>
		</div>

		<form class="form">
			<div class="field">
				<label for="name">Full name</label>
				<input id="name" type="text" placeholder="Your name" autocomplete="name" />
			</div>

			<div class="field">
				<label for="email">Email</label>
				<input id="email" type="email" placeholder="you@example.com" autocomplete="email" />
			</div>

			<div class="field">
				<label for="password">Password</label>
				<input id="password" type="password" placeholder="••••••••" autocomplete="new-password" />
			</div>

			<div class="field">
				<label for="confirm-password">Confirm password</label>
				<input id="confirm-password" type="password" placeholder="••••••••" autocomplete="new-password" />
			</div>

			<button type="submit" class="submit-btn">Create Account</button>
		</form>

		<p class="signin-prompt">
			Already have an account? <a href="/signin" class="signin-link">Sign in</a>
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
	.signup-page {
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

	label {
		font-size: 0.875rem;
		font-weight: 500;
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

	.signin-prompt {
		text-align: center;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.signin-link {
		color: var(--color-primary);
		font-weight: 500;
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
