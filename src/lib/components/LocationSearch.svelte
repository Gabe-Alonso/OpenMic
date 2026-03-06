<script lang="ts">
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';

	interface Props {
		value?: string;
		lat?: number | null;
		lng?: number | null;
	}

	let { value = '', lat = null, lng = null }: Props = $props();

	let inputValue = $state('');
	let selectedLat = $state<number | null>(null);
	let selectedLng = $state<number | null>(null);

	$effect(() => {
		inputValue = value;
		selectedLat = lat;
		selectedLng = lng;
	});
	let suggestions = $state<any[]>([]);
	let showDropdown = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	async function fetchSuggestions(q: string) {
		if (q.length < 2) {
			suggestions = [];
			showDropdown = false;
			return;
		}
		const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&types=place,region&access_token=${PUBLIC_MAPBOX_TOKEN}&limit=6`;
		const res = await fetch(url);
		const data = await res.json();
		suggestions = data.features ?? [];
		showDropdown = suggestions.length > 0;
	}

	function onInput(e: Event) {
		const q = (e.currentTarget as HTMLInputElement).value;
		inputValue = q;
		selectedLat = null;
		selectedLng = null;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => fetchSuggestions(q), 300);
	}

	function select(feature: any) {
		inputValue = feature.properties.full_address ?? feature.properties.name;
		selectedLng = feature.geometry.coordinates[0];
		selectedLat = feature.geometry.coordinates[1];
		suggestions = [];
		showDropdown = false;
	}
</script>

<div class="location-wrap">
	<input
		type="text"
		name="location"
		value={inputValue}
		oninput={onInput}
		onfocus={() => { if (suggestions.length > 0) showDropdown = true; }}
		onblur={() => setTimeout(() => { showDropdown = false; }, 150)}
		placeholder="e.g. Nashville, TN"
		autocomplete="off"
	/>
	<input type="hidden" name="location_lat" value={selectedLat ?? ''} />
	<input type="hidden" name="location_lng" value={selectedLng ?? ''} />

	{#if showDropdown}
		<ul class="dropdown">
			{#each suggestions as feature (feature.properties.mapbox_id)}
				<li>
					<button type="button" onmousedown={() => select(feature)}>
						<span class="place-name">{feature.properties.name}</span>
						<span class="place-detail">{feature.properties.place_formatted ?? ''}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.location-wrap {
		position: relative;
	}

	input[type='text'] {
		width: 100%;
		padding: 10px 14px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		background: var(--color-bg);
		color: var(--color-text);
		transition: border-color 0.15s;
		outline: none;
		font-family: inherit;
		box-sizing: border-box;
	}

	input[type='text']:focus {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	input[type='text']::placeholder {
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
		z-index: 100;
		list-style: none;
		margin: 0;
		padding: 4px;
	}

	.dropdown li {
		list-style: none;
	}

	.dropdown button {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 10px 12px;
		border-radius: calc(var(--radius-sm) - 2px);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 2px;
		transition: background 0.1s;
	}

	.dropdown button:hover {
		background: var(--color-bg);
	}

	.place-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.place-detail {
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}
</style>
