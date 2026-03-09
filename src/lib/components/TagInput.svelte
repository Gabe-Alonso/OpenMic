<script lang="ts">
	interface Props {
		tags?: string[];
		ontags?: (tags: string[]) => void;
		placeholder?: string;
	}

	let { tags = [], ontags, placeholder = 'Add tags...' }: Props = $props();

	let inputValue = $state('');

	function normalize(raw: string): string {
		return raw
			.toLowerCase()
			.replace(/^#+/, '')
			.replace(/[^a-z0-9_]/g, '')
			.slice(0, 30);
	}

	function addTag(raw: string) {
		const tag = normalize(raw);
		if (!tag || tags.includes(tag) || tags.length >= 10) return;
		ontags?.([...tags, tag]);
	}

	function removeTag(index: number) {
		ontags?.(tags.filter((_, i) => i !== index));
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag(inputValue);
			inputValue = '';
		} else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
			removeTag(tags.length - 1);
		}
	}

	function onBlur() {
		if (inputValue.trim()) {
			addTag(inputValue);
			inputValue = '';
		}
	}
</script>

<div class="tag-input">
	{#each tags as tag, i}
		<span class="chip">
			<span class="chip-text">#{tag}</span>
			<button type="button" class="chip-remove" onclick={() => removeTag(i)} aria-label="Remove #{tag}">
				×
			</button>
		</span>
	{/each}
	{#if tags.length < 10}
		<input
			class="tag-text-input"
			bind:value={inputValue}
			onkeydown={onKeydown}
			onblur={onBlur}
			{placeholder}
		/>
	{/if}
</div>

<style>
	.tag-input {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		padding: 8px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		min-height: 44px;
		cursor: text;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--color-primary-light, #f0f0ff);
		color: var(--color-primary);
		border-radius: 999px;
		padding: 2px 10px 2px 10px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.chip-text {
		line-height: 1.4;
	}

	.chip-remove {
		background: none;
		border: none;
		color: var(--color-primary);
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		padding: 0;
		margin-left: 2px;
		opacity: 0.6;
		transition: opacity 0.1s;
	}

	.chip-remove:hover {
		opacity: 1;
	}

	.tag-text-input {
		border: none;
		outline: none;
		background: transparent;
		font-size: 0.875rem;
		color: var(--color-text);
		min-width: 120px;
		flex: 1;
		padding: 2px 0;
	}

	.tag-text-input::placeholder {
		color: var(--color-text-muted);
	}
</style>
