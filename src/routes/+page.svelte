<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<div class="landing">
	<div class="hero">
		<!-- Left: logo -->
		<div class="logo-side">
			<img src="/openmic.jpg" alt="OpenMic" class="logo-img" />
		</div>

		<!-- Right: tagline, CTAs, features -->
		<div class="content-side">
			<p class="tagline">
				A place for artists to find each other, collaborate, and connect with venues.
			</p>

			{#if !data.user}
				<div class="cta-row">
					<a href="/signin" class="btn-primary">Sign up or sign in</a>
					<a href="/about" class="btn-secondary">Learn more</a>
				</div>
			{/if}

			<div class="features">
				<div class="feature">
					<div class="feature-icon">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
							<circle cx="9" cy="7" r="4"/>
							<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
							<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
						</svg>
					</div>
					<div>
						<h3>Find artists nearby</h3>
						<p>Browse profiles from musicians and artists in your area.</p>
					</div>
				</div>

				<div class="feature">
					<div class="feature-icon">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
						</svg>
					</div>
					<div>
						<h3>Message directly</h3>
						<p>Reach out to other artists to collaborate or plan performances.</p>
					</div>
				</div>

				<div class="feature">
					<div class="feature-icon">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 20h9"/>
							<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
						</svg>
					</div>
					<div>
						<h3>Share your work</h3>
						<p>Post updates and media so artists and venues can discover you.</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.landing {
		max-width: 900px;
		margin: 0 auto;
	}

	/* Two-column hero */
	.hero {
		display: flex;
		align-items: center;
		gap: 48px;
		padding: 40px 0 16px;
	}

	.logo-side {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.logo-img {
		width: 260px;
		height: 260px;
		object-fit: contain;
		border-radius: var(--radius-lg);
	}

	.content-side {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 20px;
		min-width: 0;
	}

	.tagline {
		font-size: 1.05rem;
		color: var(--color-text-muted);
		line-height: 1.65;
		margin: 0;
	}

	.cta-row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.btn-primary {
		padding: 10px 24px;
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		transition: background 0.15s;
		white-space: nowrap;
	}

	.btn-primary:hover {
		background: var(--color-primary-dark);
	}

	.btn-secondary {
		padding: 10px 24px;
		background: none;
		color: var(--color-text);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		transition: border-color 0.15s, color 0.15s;
		white-space: nowrap;
	}

	.btn-secondary:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	/* Feature list — stacked vertically on the right */
	.features {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.feature {
		display: flex;
		align-items: flex-start;
		gap: 14px;
	}

	.feature-icon {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background: var(--color-primary-light);
		color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 2px;
	}

	.feature h3 {
		font-size: 0.875rem;
		font-weight: 700;
		margin: 0 0 2px;
		letter-spacing: -0.1px;
	}

	.feature p {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		line-height: 1.55;
		margin: 0;
	}

	/* Collapse to single column on small screens */
	@media (max-width: 580px) {
		.hero {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}

		.logo-img {
			width: 180px;
			height: 180px;
		}

		.cta-row {
			justify-content: center;
		}
	}
</style>
