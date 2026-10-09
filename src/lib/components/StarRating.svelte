<script lang="ts">
	interface Props {
		value: number;
		size?: number;
		interactive?: boolean;
		onrate?: (value: number) => void;
	}

	let { value, size = 18, interactive = false, onrate }: Props = $props();

	let hoverValue = $state<number | null>(null);
	const displayValue = $derived(hoverValue ?? value);

	// Each star is two half-width hit targets so a click can land on either
	// half, giving 0.5-step granularity without a slider.
	function fillFor(starIndex: number, v: number): 'full' | 'half' | 'empty' {
		const diff = v - starIndex;
		if (diff >= 1) return 'full';
		if (diff >= 0.5) return 'half';
		return 'empty';
	}

	function handlePick(starIndex: number, half: 'left' | 'right') {
		if (!interactive) return;
		onrate?.(starIndex + (half === 'left' ? 0.5 : 1));
	}

	function handleHover(starIndex: number, half: 'left' | 'right') {
		if (!interactive) return;
		hoverValue = starIndex + (half === 'left' ? 0.5 : 1);
	}
</script>

<div
	class="star-rating"
	class:interactive
	style="--star-size: {size}px"
	onmouseleave={() => (hoverValue = null)}
	role={interactive ? 'radiogroup' : 'img'}
	aria-label={interactive ? 'Select a rating' : `Rated ${value} out of 5`}
>
	{#each [0, 1, 2, 3, 4] as starIndex}
		{@const fill = fillFor(starIndex, displayValue)}
		<span class="star" class:full={fill === 'full'} class:half={fill === 'half'}>
			<svg viewBox="0 0 24 24" width={size} height={size}>
				<defs>
					<clipPath id="half-clip-{starIndex}">
						<rect x="0" y="0" width="12" height="24" />
					</clipPath>
				</defs>
				<path
					class="star-outline"
					d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
				/>
				{#if fill === 'full'}
					<path
						d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
						fill="currentColor"
					/>
				{:else if fill === 'half'}
					<path
						clip-path="url(#half-clip-{starIndex})"
						d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
						fill="currentColor"
					/>
				{/if}
			</svg>
			{#if interactive}
				<button
					type="button"
					class="hit-half hit-left"
					aria-label="{starIndex + 0.5} stars"
					onmouseenter={() => handleHover(starIndex, 'left')}
					onclick={() => handlePick(starIndex, 'left')}
				></button>
				<button
					type="button"
					class="hit-half hit-right"
					aria-label="{starIndex + 1} stars"
					onmouseenter={() => handleHover(starIndex, 'right')}
					onclick={() => handlePick(starIndex, 'right')}
				></button>
			{/if}
		</span>
	{/each}
</div>

<style>
	.star-rating {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		color: #f5a623;
	}

	.star {
		position: relative;
		display: inline-flex;
		width: var(--star-size);
		height: var(--star-size);
	}

	.star-outline {
		color: var(--color-border-strong);
	}

	.star.full :global(.star-outline),
	.star.half :global(.star-outline) {
		color: #f5a623;
	}

	.hit-half {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 50%;
		padding: 0;
		margin: 0;
		background: none;
		border: none;
		cursor: pointer;
	}

	.hit-left {
		left: 0;
	}

	.hit-right {
		right: 0;
	}

	.interactive .star {
		cursor: pointer;
	}
</style>
