<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<div class="landing">
	<div class="hero">
		<div class="hero-glow" aria-hidden="true"></div>
		<div class="hero-dots" aria-hidden="true"></div>

		<div class="hero-grid">
			<div class="hero-copy">
				<div class="hero-badge">
					<span class="badge-dot"></span>
					For local musicians and venues
				</div>

				<h1>Find your band.<br /><span class="accent">Find your stage.</span></h1>

				<p class="hero-sub">A place for artists to find each other, collaborate, and connect with venues.</p>

				{#if !data.user}
					<div class="cta-row">
						<a href="/signin" class="btn btn-cream hero-cta">
							Sign up or sign in
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
						</a>
						<a href="/about" class="btn btn-ghost hero-cta">Learn more</a>
					</div>
				{:else}
					<div class="cta-row">
						<a href="/community" class="btn btn-cream hero-cta">
							Go to Community
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
						</a>
						<a href="/artists" class="btn btn-ghost hero-cta">Browse artists</a>
					</div>
				{/if}
			</div>

			<div class="stage">
				<div class="ring ring-a" aria-hidden="true"></div>
				<div class="ring ring-b" aria-hidden="true"></div>
				<div class="ring ring-c" aria-hidden="true"></div>

				<div class="stage-card">
					<img src="/openmic.jpg" alt="OpenMic logo: a purple microphone and music note" />
				</div>

				<div class="chip chip-1">
					<span class="chip-icon chip-icon-deep">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
					</span>
					Looking for a drummer
				</div>

				<div class="chip chip-2 chip-optional">
					<span class="chip-icon chip-icon-translucent">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
					</span>
					Venue open to bookings
				</div>

				<div class="chip chip-3 chip-optional">
					<span class="chip-icon chip-icon-lilac">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
					</span>
					Songwriter seeking collab
				</div>
			</div>
		</div>
	</div>

	<div class="features">
		<div class="features-head">
			<span class="eyebrow">What you can do</span>
			<h2>Everything between the garage and the gig.</h2>
		</div>

		<div class="features-grid">
			<a href="/artists" class="feature-card card-hover fc-violet">
				<div class="fc-top">
					<span class="fc-icon fc-icon-translucent">
						<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
					</span>
					<span class="fc-num fc-num-light">01</span>
				</div>
				<div class="fc-text">
					<h3>Find artists nearby</h3>
					<p>Browse profiles from musicians and artists in your area.</p>
				</div>
			</a>

			<a href="/messages" class="feature-card card-hover fc-white">
				<div class="fc-top">
					<span class="fc-icon fc-icon-primary">
						<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					</span>
					<span class="fc-num fc-num-muted">02</span>
				</div>
				<div class="fc-text">
					<h3>Message directly</h3>
					<p>Reach out to other artists to collaborate or plan performances.</p>
				</div>
			</a>

			<a href="/post/new" class="feature-card card-hover fc-white">
				<div class="fc-top">
					<span class="fc-icon fc-icon-primary">
						<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
					</span>
					<span class="fc-num fc-num-muted">03</span>
				</div>
				<div class="fc-text">
					<h3>Share your work</h3>
					<p>Post updates and media so artists and venues can discover you.</p>
				</div>
			</a>

			<a href="/venues" class="feature-card card-hover fc-lilac">
				<div class="fc-top">
					<span class="fc-icon fc-icon-ink">
						<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
					</span>
					<span class="fc-num fc-num-dark">04</span>
				</div>
				<div class="fc-text">
					<h3>Meet local venues</h3>
					<p>Discover venues near you, or claim the listing if you run one.</p>
				</div>
			</a>
		</div>
	</div>

	<div class="closing-wrap">
		<div class="closing-band">
			<div class="band-ring band-ring-a" aria-hidden="true"></div>
			<div class="band-ring band-ring-b" aria-hidden="true"></div>
			<div class="band-blob" aria-hidden="true"></div>

			<span class="eyebrow band-eyebrow">Why OpenMic exists</span>
			<h2 class="band-heading">Started by a musician who couldn't find a place to play.</h2>
			<p class="band-sub">Now it's a place for artists to find each other, and a stage for anyone who wants to be heard.</p>

			{#if !data.user}
				<div class="cta-row">
					<a href="/signup" class="btn btn-cream">Join OpenMic</a>
					<a href="/about" class="btn btn-ghost">Read the story</a>
				</div>
			{:else}
				<div class="cta-row">
					<a href="/community" class="btn btn-cream">Go to Community</a>
					<a href="/about" class="btn btn-ghost">Read the story</a>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.landing {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
	}

	/* ============ HERO ============ */
	.hero {
		position: relative;
		margin: -112px -20px 0;
		padding: 160px 24px 112px;
		background: var(--color-ink);
		border-radius: 0 0 48px 48px;
		overflow: hidden;
		color: white;
	}

	.hero-glow {
		position: absolute;
		top: -220px;
		right: -120px;
		width: 900px;
		height: 900px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(124, 58, 237, 0.55) 0%, rgba(124, 58, 237, 0) 62%);
		pointer-events: none;
	}

	.hero-dots {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
		background-size: 28px 28px;
		pointer-events: none;
	}

	.hero-grid {
		position: relative;
		max-width: 1152px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(460px, 100%), 1fr));
		gap: 56px;
		align-items: center;
	}

	.hero-copy {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 28px;
	}

	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 7px 14px 7px 12px;
		border-radius: var(--radius-pill);
		background: rgba(196, 181, 253, 0.12);
		border: 1px solid rgba(196, 181, 253, 0.28);
		color: var(--color-lilac-soft);
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.badge-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-lilac);
	}

	.hero h1 {
		margin: 0;
		font-size: clamp(2.875rem, 7vw, 5.5rem);
		line-height: 0.98;
		letter-spacing: -0.035em;
		color: var(--color-cream);
	}

	.hero h1 .accent {
		color: var(--color-lilac-bright);
	}

	.hero-sub {
		margin: 0;
		max-width: 520px;
		font-size: 1.1875rem;
		line-height: 1.6;
		color: var(--color-lilac-soft);
	}

	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 4px;
	}

	.hero-cta {
		height: 56px;
		padding: 0 30px;
		font-size: 1rem;
	}

	.btn-ghost {
		background: transparent;
		color: var(--color-cream);
		border: 1.5px solid rgba(255, 255, 255, 0.28);
	}

	.btn-ghost:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.5);
	}

	/* Stage visual */
	.stage {
		position: relative;
		min-height: 460px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ring {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
	}

	.ring-a {
		width: 440px;
		height: 440px;
		border: 1px solid rgba(196, 181, 253, 0.22);
	}

	.ring-b {
		width: 340px;
		height: 340px;
		border: 1px solid rgba(196, 181, 253, 0.32);
	}

	.ring-c {
		width: 560px;
		height: 560px;
		max-width: 120%;
		border: 1px dashed rgba(196, 181, 253, 0.14);
	}

	.stage-card {
		position: relative;
		width: 280px;
		height: 280px;
		border-radius: var(--radius-card-lg);
		background: var(--color-cream);
		overflow: hidden;
		transform: rotate(-4deg);
		box-shadow: 0 40px 80px rgba(8, 2, 22, 0.55), 0 0 0 10px rgba(246, 241, 231, 0.08);
	}

	.stage-card img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.chip {
		position: absolute;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px 10px 10px;
		border-radius: var(--radius-pill);
		font-size: 0.875rem;
		font-weight: 600;
		box-shadow: 0 16px 32px rgba(8, 2, 22, 0.4);
	}

	.chip-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.chip-icon-deep {
		background: var(--color-primary-deep);
		color: white;
	}

	.chip-icon-translucent {
		background: rgba(255, 255, 255, 0.2);
		color: white;
	}

	.chip-icon-lilac {
		background: rgba(196, 181, 253, 0.18);
		color: var(--color-lilac);
	}

	.chip-1 {
		top: 34px;
		left: 0;
		background: var(--color-cream);
		color: var(--color-ink);
		transform: rotate(-3deg);
	}

	.chip-2 {
		bottom: 70px;
		right: 0;
		background: var(--color-primary-bright);
		color: white;
		transform: rotate(3deg);
	}

	.chip-3 {
		bottom: 8px;
		left: 8%;
		background: var(--color-panel);
		border: 1px solid rgba(196, 181, 253, 0.35);
		color: var(--color-cream);
		transform: rotate(-2deg);
	}

	/* ============ FEATURES ============ */
	.features {
		padding: 112px 24px 40px;
	}

	.features-head {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 720px;
		margin-bottom: 48px;
	}

	.features-head .eyebrow {
		color: var(--color-primary);
	}

	.features-head h2 {
		margin: 0;
		font-size: clamp(2.125rem, 5vw, 3.5rem);
		line-height: 1.02;
		letter-spacing: -0.03em;
		color: var(--color-ink);
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(480px, 100%), 1fr));
		gap: 20px;
	}

	.feature-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 56px;
		min-height: 280px;
		padding: 36px;
		border-radius: var(--radius-card-lg);
		text-decoration: none;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.feature-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-card-hover);
	}

	.fc-violet {
		background: var(--color-primary);
		color: white;
	}

	.fc-white {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-ink);
	}

	.fc-lilac {
		background: var(--color-lilac-soft);
		color: var(--color-ink);
	}

	.fc-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.fc-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 18px;
	}

	.fc-icon-translucent {
		background: rgba(255, 255, 255, 0.16);
	}

	.fc-icon-primary {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.fc-icon-ink {
		background: var(--color-ink);
		color: var(--color-lilac-soft);
	}

	.fc-num {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.25rem;
	}

	.fc-num-light {
		color: var(--color-lilac-soft);
	}

	.fc-num-muted {
		color: #7c6aa8;
	}

	.fc-num-dark {
		color: var(--color-primary-dark);
	}

	.fc-text {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.fc-text h3 {
		margin: 0;
		font-size: 1.875rem;
		letter-spacing: -0.02em;
	}

	.fc-text p {
		margin: 0;
		max-width: 420px;
		font-size: 1rem;
		line-height: 1.6;
		opacity: 0.85;
	}

	/* ============ CLOSING BAND ============ */
	.closing-wrap {
		padding: 72px 24px 96px;
	}

	.closing-band {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 28px;
		padding: clamp(36px, 6vw, 80px);
		border-radius: var(--radius-panel);
		background: var(--color-ink);
		color: white;
	}

	.band-ring {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
	}

	.band-ring-a {
		right: -140px;
		top: -140px;
		width: 520px;
		height: 520px;
		border: 1px solid rgba(196, 181, 253, 0.25);
	}

	.band-ring-b {
		right: -60px;
		top: -60px;
		width: 360px;
		height: 360px;
		border: 1px solid rgba(196, 181, 253, 0.35);
	}

	.band-blob {
		position: absolute;
		right: 20px;
		top: 20px;
		width: 200px;
		height: 200px;
		border-radius: 50%;
		background: var(--color-primary);
		opacity: 0.55;
		pointer-events: none;
	}

	.band-eyebrow {
		position: relative;
		color: var(--color-lilac-bright);
	}

	.band-heading {
		position: relative;
		margin: 0;
		max-width: 760px;
		font-size: clamp(2.125rem, 5vw, 3.75rem);
		line-height: 1.02;
		letter-spacing: -0.03em;
		color: var(--color-cream);
	}

	.band-sub {
		position: relative;
		margin: 0;
		max-width: 560px;
		font-size: 1.125rem;
		line-height: 1.6;
		color: var(--color-lilac-soft);
	}

	.closing-band .cta-row {
		position: relative;
	}

	/* Collapse on small screens */
	@media (max-width: 760px) {
		.hero {
			margin: -84px -20px 0;
			padding: 120px 20px 72px;
			border-radius: var(--radius-card-lg);
		}

		.stage {
			min-height: 360px;
		}
	}

	@media (max-width: 560px) {
		.chip-optional {
			display: none;
		}
	}
</style>
