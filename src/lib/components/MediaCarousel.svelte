<script lang="ts">
	interface MediaItem {
		type: 'youtube' | 'image';
		src: string; // embed URL for youtube, image URL for image
	}

	interface Props {
		items: MediaItem[];
	}

	let { items }: Props = $props();

	let current = $state(0);

	function prev() {
		current = (current - 1 + items.length) % items.length;
	}

	function next() {
		current = (current + 1) % items.length;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') prev();
		if (e.key === 'ArrowRight') next();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="carousel" tabindex={0} onkeydown={onKeydown}>
	{#each items as item, i}
		{#if i === current}
			<div class="slide">
				{#if item.type === 'youtube'}
					<iframe
						src={item.src}
						title="Video"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				{:else}
					<img src={item.src} alt="" />
				{/if}
			</div>
		{/if}
	{/each}

	{#if items.length > 1}
		<button class="nav prev" onclick={prev} aria-label="Previous">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
		</button>
		<button class="nav next" onclick={next} aria-label="Next">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
		</button>
		<div class="dots">
			{#each items as _, i}
				<button
					class="dot"
					class:active={i === current}
					onclick={() => (current = i)}
					aria-label="Go to slide {i + 1}"
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.carousel {
		position: relative;
		width: 100%;
		height: 100%;
		background: #111;
		outline: none;
		overflow: hidden;
	}

	.slide {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.slide img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.slide iframe {
		width: 100%;
		height: 100%;
		border: none;
	}

	/* Nav arrows */
	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		background: rgba(255, 255, 255, 0.15);
		border: none;
		border-radius: 50%;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		cursor: pointer;
		transition: background 0.15s;
		backdrop-filter: blur(4px);
	}

	.nav:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.prev {
		left: 12px;
	}

	.next {
		right: 12px;
	}

	/* Dots */
	.dots {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 6px;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		transition: background 0.15s, transform 0.15s;
		padding: 0;
	}

	.dot.active {
		background: white;
		transform: scale(1.2);
	}
</style>
