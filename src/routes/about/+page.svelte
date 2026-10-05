<div class="about-page">

	<div class="hero">
		<div class="hero-glow" aria-hidden="true"></div>
		<div class="hero-dots" aria-hidden="true"></div>

		<div class="hero-grid">
			<div class="hero-copy">
				<span class="eyebrow">About</span>
				<h1>About <span class="accent">OpenMic</span></h1>
				<p class="tagline">A place to connect musicians and venues</p>
			</div>

			<div class="stage">
				<div class="ring ring-a" aria-hidden="true"></div>
				<div class="ring ring-b" aria-hidden="true"></div>

				<div class="stage-card">
					<img src="/openmic.jpg" alt="OpenMic logo: a purple microphone and music note" />
				</div>
			</div>
		</div>
	</div>

	<div class="sections">

		<section class="editorial-row">
			<div class="row-label">
				<div class="row-head">
					<span class="row-index">01</span>
					<span class="row-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
					</span>
				</div>
				<h2>Where the idea came from</h2>
			</div>
			<div class="row-body">
				<p>OpenMic started as a project in a business class I took back in college, where the assignment was to identify
					an issue and create a startup to address it. I was in a band at the time, and something I had struggled with
					for a while was finding opportunities to perform at local venues. We played a somewhat niche genre for
					the area, and really only ended up playing at cultural school events. While this meant we had some
					guaranteed performance opportunities, it was still difficult to expand past playing at our university.</p>
				<p>Lacking many connections and general experience, all I was able to do at the time was look up what places
					around us had live performances and reach out to see if our band could join their lineup. I was mostly
					either ignored or communication ended up being poor and inconsistent.</p>
			</div>
		</section>

		<section class="editorial-row">
			<div class="row-label">
				<div class="row-head">
					<span class="row-index">02</span>
					<span class="row-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
					</span>
				</div>
				<h2>How I hope you use it</h2>
			</div>
			<div class="row-body">
				<p>At first, the goal was just to create a simple way for musicians and venues to connect. However, I realized
					that if people were advertising themselves as artists already, then allowing them to find other artists to
					collaborate with would be a natural extension.</p>
				<p>The goal for now while the platform is in such an early stage is to try to get some interactions going and
					see how people are using it. Connecting with venues has been a core part of the OpenMic vision from the start,
					but getting them to change up how their booking process works has proven to be a bigger hurdle than anticipated.
					This is mostly a personal project for me for now, so I'm not sure if venues will be something I will be able to
					properly address in the way I wanted to, but for now, I think that this platform is at least capable of helping
					some artists find each other and collaborate, as limited as it is right now, which is something I'm happy about.
					If you are an artist and see any potential in this platform, I would be happy if you gave it a try and
					told your friends about it so that more people can find each other.
				</p>
			</div>
		</section>

	</div>

	<div class="closing-wrap">
		<div class="closing-band">
			<div class="band-ring band-ring-a" aria-hidden="true"></div>
			<div class="band-ring band-ring-b" aria-hidden="true"></div>
			<div class="band-blob" aria-hidden="true"></div>

			<span class="band-icon" aria-hidden="true">
				<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
			</span>
			<h2 class="band-heading">Get in touch</h2>
			<p class="band-sub">Have a suggestion, found a bug, or any other kind of feedback? Let me know!</p>

			<div class="contact-block">
				<span class="contact-label">Suggestions, bug reports, &amp; feedback</span>
				<a href="mailto:openmicplat@gmail.com" class="btn btn-cream contact-btn">
					openmicplat@gmail.com
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>
				</a>
			</div>
		</div>
	</div>
</div>

<style>
	.about-page {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
	}

	/* ============ HERO ============ */
	.hero {
		position: relative;
		margin: -112px -20px 0;
		padding: 160px 24px 104px;
		background: var(--color-ink);
		border-radius: 0 0 48px 48px;
		overflow: hidden;
		color: white;
	}

	.hero-glow {
		position: absolute;
		top: -220px;
		right: -120px;
		width: 860px;
		height: 860px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(124, 58, 237, 0.5) 0%, rgba(124, 58, 237, 0) 62%);
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
		grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
		gap: 48px;
		align-items: center;
	}

	.hero-copy {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 24px;
	}

	.hero-copy .eyebrow {
		color: var(--color-lilac-bright);
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

	.tagline {
		margin: 0;
		max-width: 480px;
		font-size: 1.3125rem;
		line-height: 1.5;
		color: var(--color-lilac-soft);
	}

	/* Stage visual */
	.stage {
		position: relative;
		min-height: 300px;
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
		width: 380px;
		height: 380px;
		border: 1px solid rgba(196, 181, 253, 0.22);
	}

	.ring-b {
		width: 290px;
		height: 290px;
		border: 1px solid rgba(196, 181, 253, 0.34);
	}

	.stage-card {
		position: relative;
		width: 210px;
		height: 210px;
		border-radius: 40px;
		background: var(--color-cream);
		overflow: hidden;
		transform: rotate(4deg);
		box-shadow: 0 36px 70px rgba(8, 2, 22, 0.55), 0 0 0 9px rgba(246, 241, 231, 0.08);
	}

	.stage-card img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* ============ EDITORIAL SECTIONS ============ */
	.sections {
		display: flex;
		flex-direction: column;
		max-width: 1100px;
		margin: 0 auto;
		width: 100%;
		padding: 0 24px;
	}

	.editorial-row {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 40px 64px;
		padding: 72px 0;
		border-top: 1px solid var(--color-border-soft);
	}

	.row-label {
		display: flex;
		flex-direction: column;
		gap: 18px;
		align-self: start;
	}

	.row-head {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.row-index {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.25rem;
		color: var(--color-primary);
	}

	.row-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border-radius: 18px;
		background: var(--color-primary-light);
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.row-label h2 {
		margin: 0;
		font-size: clamp(1.875rem, 3.6vw, 2.75rem);
		line-height: 1.04;
		letter-spacing: -0.03em;
	}

	.row-body {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 640px;
		min-width: 0;
	}

	.row-body p {
		margin: 0;
		font-size: 1.1875rem;
		line-height: 1.75;
		color: var(--color-text-body);
	}

	/* ============ CLOSING BAND ============ */
	.closing-wrap {
		max-width: 1100px;
		margin: 0 auto;
		width: 100%;
		padding: 24px 24px 96px;
	}

	.closing-band {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 24px;
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

	.band-icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.1);
		color: var(--color-lilac-soft);
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
		max-width: 520px;
		font-size: 1.1875rem;
		line-height: 1.6;
		color: var(--color-lilac-soft);
	}

	.contact-block {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.contact-label {
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-lilac-bright);
	}

	.contact-btn {
		height: 56px;
		padding: 0 30px;
		font-size: 1rem;
		align-self: flex-start;
	}

	@media (max-width: 720px) {
		.hero {
			margin: -16px -12px 0;
			padding: 120px 20px 72px;
		}

		.editorial-row {
			grid-template-columns: 1fr;
			gap: 14px;
			padding: 48px 0;
		}

		.stage {
			min-height: 220px;
		}

		.ring-a {
			width: 260px;
			height: 260px;
		}

		.ring-b {
			width: 190px;
			height: 190px;
		}

		.stage-card {
			width: 160px;
			height: 160px;
			border-radius: 32px;
		}
	}
</style>
