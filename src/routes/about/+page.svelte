<div class="about-page">

	<div class="hero">
		<h1>About OpenMic</h1>
		<p class="tagline">A place to connect musicians and venues</p>
	</div>

	<div class="sections">

		<section class="card">
			<div class="section-icon">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
				</svg>
			</div>
			<div class="section-body">
				<h2>Where the idea came from</h2>
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

		<section class="card">
			<div class="section-icon">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
				</svg>
			</div>
			<div class="section-body">
				<h2>How I hope you use it</h2>
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

		<section class="card">
			<div class="section-icon">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
				</svg>
			</div>
			<div class="section-body">
				<h2>Get in touch</h2>
				<p>Have a suggestion, found a bug, or any other kind of feedback? Let me know!</p>
				<div class="contact-items">
					<div class="contact-item">
						<span class="contact-label">Suggestions, bug reports, &amp; feedback</span>
						<a href="mailto:openmicplat@gmail.com" class="contact-value">openmicplat@gmail.com</a>
					</div>
				</div>
			</div>
		</section>

	</div>
</div>

<style>
	.about-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.hero {
		text-align: center;
		padding: 12px 0 8px;
	}

	h1 {
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: -0.6px;
		color: var(--color-text);
		margin-bottom: 10px;
	}

	.tagline {
		font-size: 1.05rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.card {
		display: flex;
		gap: 20px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 28px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
	}

	.section-icon {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		background: var(--color-primary-light, #f0f0ff);
		color: var(--color-primary);
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 2px;
	}

	.section-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	h2 {
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: -0.2px;
		margin: 0;
	}

	.section-body p {
		font-size: 0.9rem;
		line-height: 1.7;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Contact section */
	.contact-items {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 4px;
	}

	.contact-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.875rem;
	}

	.contact-label {
		color: var(--color-text-muted);
	}

	.contact-value {
		font-weight: 500;
		color: var(--color-text);
	}

</style>
