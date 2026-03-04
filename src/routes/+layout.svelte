<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app">
	<div class="header-wrap">
		<header>
			<nav class="nav-left">
				<a href="/" class="logo">OpenMic</a>
				<div class="nav-links">
					<a href="/">Home</a>
					<a href="/artists">Artists</a>
					<a href="/venues">Venues</a>
				</div>
			</nav>

			<div class="nav-right">
				<div class="profile-wrapper">
					<button class="profile-btn" aria-label="Profile">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="8" r="4" />
							<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
						</svg>
					</button>
					<div class="profile-dropdown">
						<p class="dropdown-title">Not signed in</p>
						<p class="dropdown-sub">Sign in to connect with artists and venues.</p>
						<a href="/signin" class="dropdown-signin-btn">Sign In</a>
					</div>
				</div>
			</div>
		</header>
	</div>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
	}

	.header-wrap {
		padding: 16px 20px 0;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 12px 20px;
		box-shadow: var(--shadow-md);
		border: 1px solid var(--color-border);
	}

	.nav-left {
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.logo {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--color-primary);
		letter-spacing: -0.4px;
	}

	.nav-links {
		display: flex;
		gap: 2px;
	}

	.nav-links a {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		padding: 6px 12px;
		border-radius: var(--radius-sm);
		transition: background 0.15s, color 0.15s;
	}

	.nav-links a:hover {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	/* Profile */
	.nav-right {
		display: flex;
		align-items: center;
	}

	.profile-wrapper {
		position: relative;
	}

	.profile-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		color: var(--color-text-muted);
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}

	.profile-btn:hover {
		background: var(--color-primary-light);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.profile-dropdown {
		display: none;
		position: absolute;
		right: 0;
		top: calc(100% + 10px);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		padding: 16px;
		width: 220px;
		z-index: 200;
	}

	.profile-wrapper:hover .profile-dropdown {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.dropdown-title {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.dropdown-sub {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		line-height: 1.45;
	}

	.dropdown-signin-btn {
		display: block;
		text-align: center;
		background: var(--color-primary);
		color: white;
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		transition: background 0.15s;
	}

	.dropdown-signin-btn:hover {
		background: var(--color-primary-dark);
	}

	main {
		padding: 28px 20px;
	}
</style>
