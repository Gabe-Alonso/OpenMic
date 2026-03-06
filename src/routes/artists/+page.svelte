<script lang="ts">
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { onMount } from 'svelte';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mapContainer: HTMLDivElement;
	let map: any = null;
	let visibleArtists = $state(data.artists);
	let activeArtistId = $state<string | null>(null);

	// Search state
	let searchInput = $state('');
	let searchSuggestions = $state<any[]>([]);
	let showSearchDropdown = $state(false);
	let searchLat = $state<number | null>(null);
	let searchLng = $state<number | null>(null);
	let searchRadius = $state(25);
	let debounceTimer: ReturnType<typeof setTimeout>;

	const RADIUS_OPTIONS = [10, 25, 50, 100, 250];

	function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
		const R = 3958.8;
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLng = ((lng2 - lng1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) ** 2 +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLng / 2) ** 2;
		return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}

	function radiusToZoom(miles: number): number {
		if (miles <= 10) return 11;
		if (miles <= 25) return 10;
		if (miles <= 50) return 9;
		if (miles <= 100) return 8;
		return 7;
	}

	function filterByBounds() {
		if (!map) return;
		const bounds = map.getBounds();
		visibleArtists = data.artists.filter((a) =>
			bounds.contains([a.location_lng!, a.location_lat!])
		);
	}

	function filterByRadius(lat: number, lng: number, radius: number) {
		visibleArtists = data.artists.filter(
			(a) => distanceMiles(lat, lng, a.location_lat!, a.location_lng!) <= radius
		);
	}

	// Re-filter and re-center when radius changes while a location is active
	$effect(() => {
		const lat = searchLat;
		const lng = searchLng;
		const radius = searchRadius;
		if (lat !== null && lng !== null) {
			filterByRadius(lat, lng, radius);
			map?.flyTo({ center: [lng, lat], zoom: radiusToZoom(radius) });
		}
	});

	async function fetchSearchSuggestions(q: string) {
		if (q.length < 2) {
			searchSuggestions = [];
			showSearchDropdown = false;
			return;
		}
		const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&types=place,region&access_token=${PUBLIC_MAPBOX_TOKEN}&limit=5`;
		const res = await fetch(url);
		const json = await res.json();
		searchSuggestions = json.features ?? [];
		showSearchDropdown = searchSuggestions.length > 0;
	}

	function onSearchInput(e: Event) {
		const q = (e.currentTarget as HTMLInputElement).value;
		searchInput = q;
		// Clear active location so map-bounds filtering resumes
		searchLat = null;
		searchLng = null;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => fetchSearchSuggestions(q), 300);
	}

	function selectSearchLocation(feature: any) {
		searchInput = feature.properties.full_address ?? feature.properties.name;
		searchLng = feature.geometry.coordinates[0];
		searchLat = feature.geometry.coordinates[1]; // triggers $effect
		searchSuggestions = [];
		showSearchDropdown = false;
	}

	function clearSearch() {
		searchInput = '';
		searchLat = null;
		searchLng = null;
		searchSuggestions = [];
		showSearchDropdown = false;
		filterByBounds();
	}

	onMount(async () => {
		const mapboxgl = (await import('mapbox-gl')).default;
		mapboxgl.accessToken = PUBLIC_MAPBOX_TOKEN;

		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/mapbox/light-v11',
			center: [-98, 39],
			zoom: 3.5
		});

		data.artists.forEach((artist) => {
			const el = document.createElement('div');
			el.className = 'artist-marker';
			if (artist.avatar_url) {
				el.innerHTML = `<img src="${artist.avatar_url}" alt="${artist.full_name ?? ''}" />`;
			} else {
				el.textContent = (artist.full_name?.[0] ?? '?').toUpperCase();
			}

			const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
				<strong style="font-size:0.875rem;font-weight:600;display:block;">${artist.full_name ?? 'Artist'}</strong>
				${artist.location ? `<span style="font-size:0.78rem;color:#71717a;display:block;margin:2px 0 8px;">${artist.location}</span>` : '<div style="margin-bottom:8px;"></div>'}
				<a href="/profile/${artist.id}" style="font-size:0.8rem;color:#7c3aed;font-weight:500;text-decoration:none;">View Profile →</a>
			`);

			new mapboxgl.Marker({ element: el })
				.setLngLat([artist.location_lng!, artist.location_lat!])
				.setPopup(popup)
				.addTo(map);

			el.addEventListener('click', () => {
				activeArtistId = artist.id;
				document
					.getElementById(`artist-${artist.id}`)
					?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			});
		});

		if (data.artists.length === 1) {
			map.flyTo({
				center: [data.artists[0].location_lng!, data.artists[0].location_lat!],
				zoom: 8
			});
		} else if (data.artists.length > 1) {
			const bounds = new mapboxgl.LngLatBounds();
			data.artists.forEach((a) => bounds.extend([a.location_lng!, a.location_lat!]));
			map.fitBounds(bounds, { padding: 80, maxZoom: 10 });
		}

		// Only update by bounds when no search location is active
		map.on('load', () => { if (searchLat === null) filterByBounds(); });
		map.on('moveend', () => { if (searchLat === null) filterByBounds(); });

		return () => map.remove();
	});
</script>

<div class="artists-page">
	<div class="map-panel" bind:this={mapContainer}></div>

	<div class="list-panel">
		<div class="search-section">
			<div class="search-row">
				<div class="search-input-wrap">
					<svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
					</svg>
					<input
						type="text"
						value={searchInput}
						oninput={onSearchInput}
						onfocus={() => { if (searchSuggestions.length > 0) showSearchDropdown = true; }}
						onblur={() => setTimeout(() => { showSearchDropdown = false; }, 150)}
						placeholder="Search by location…"
						autocomplete="off"
						class="search-input"
					/>
					{#if searchInput}
						<button class="clear-btn" type="button" onclick={clearSearch} aria-label="Clear">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
								<path d="M18 6 6 18M6 6l12 12" />
							</svg>
						</button>
					{/if}
					{#if showSearchDropdown}
						<ul class="search-dropdown">
							{#each searchSuggestions as feature (feature.properties.mapbox_id)}
								<li>
									<button type="button" onmousedown={() => selectSearchLocation(feature)}>
										<span class="place-name">{feature.properties.name}</span>
										<span class="place-detail">{feature.properties.place_formatted ?? ''}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				<select
					class="radius-select"
					bind:value={searchRadius}
					disabled={searchLat === null}
					title={searchLat === null ? 'Search a location first' : `Within ${searchRadius} miles`}
				>
					{#each RADIUS_OPTIONS as r}
						<option value={r}>{r} mi</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="list-header">
			<h1>Artists</h1>
			<p>
				{visibleArtists.length}
				{visibleArtists.length === 1 ? 'artist' : 'artists'}
				{searchLat !== null ? `within ${searchRadius} miles` : 'in view'}
			</p>
		</div>

		<div class="artist-list">
			{#if data.artists.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🎵</span>
					<p class="empty-title">No artists yet</p>
					<p class="empty-sub">Artists will appear here once they set their location and make themselves discoverable.</p>
				</div>
			{:else if visibleArtists.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🗺️</span>
					<p class="empty-title">No artists in this area</p>
					<p class="empty-sub">
						{searchLat !== null
							? 'Try increasing the radius or searching a different location.'
							: 'Try zooming out or panning the map.'}
					</p>
				</div>
			{:else}
				{#each visibleArtists as artist (artist.id)}
					<a
						href="/profile/{artist.id}"
						id="artist-{artist.id}"
						class="artist-card"
						class:active={activeArtistId === artist.id}
					>
						<div class="artist-avatar">
							{#if artist.avatar_url}
								<img src={artist.avatar_url} alt={artist.full_name ?? ''} />
							{:else}
								<span>{(artist.full_name?.[0] ?? '?').toUpperCase()}</span>
							{/if}
						</div>
						<div class="artist-info">
							<p class="artist-name">{artist.full_name ?? 'Anonymous Artist'}</p>
							{#if artist.location}
								<p class="artist-location">{artist.location}</p>
							{/if}
							{#if artist.bio}
								<p class="artist-bio">{artist.bio}</p>
							{/if}
						</div>
					</a>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.artists-page {
		display: flex;
		height: calc(100vh - 110px);
		margin: -28px -20px;
		overflow: hidden;
	}

	.map-panel {
		flex: 1;
		min-width: 0;
	}

	.list-panel {
		width: 380px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--color-bg);
		border-left: 1px solid var(--color-border);
		overflow: hidden;
	}

	/* Search */
	.search-section {
		padding: 12px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.search-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.search-input-wrap {
		position: relative;
		flex: 1;
		min-width: 0;
	}

	.search-icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-text-muted);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 9px 32px 9px 34px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		background: var(--color-bg);
		color: var(--color-text);
		outline: none;
		font-family: inherit;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}

	.search-input:focus {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	.search-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	.clear-btn {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: color 0.15s;
	}

	.clear-btn:hover {
		color: var(--color-text);
	}

	.search-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
		z-index: 200;
		list-style: none;
		margin: 0;
		padding: 4px;
	}

	.search-dropdown li {
		list-style: none;
	}

	.search-dropdown button {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 8px 12px;
		border-radius: calc(var(--radius-sm) - 2px);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 1px;
		transition: background 0.1s;
	}

	.search-dropdown button:hover {
		background: var(--color-bg);
	}

	.place-name {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.place-detail {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.radius-select {
		padding: 9px 10px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		background: var(--color-bg);
		color: var(--color-text);
		outline: none;
		font-family: inherit;
		cursor: pointer;
		transition: border-color 0.15s, opacity 0.15s;
		flex-shrink: 0;
	}

	.radius-select:not(:disabled):focus {
		border-color: var(--color-primary);
	}

	.radius-select:disabled {
		opacity: 0.45;
		cursor: default;
	}

	/* List header */
	.list-header {
		padding: 16px 20px 12px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.list-header h1 {
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: -0.3px;
	}

	.list-header p {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		margin-top: 2px;
	}

	.artist-list {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* Artist card */
	.artist-card {
		display: flex;
		gap: 12px;
		padding: 14px;
		border-radius: var(--radius-md);
		border: 1.5px solid var(--color-border);
		background: var(--color-surface);
		text-decoration: none;
		color: var(--color-text);
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.artist-card:hover,
	.artist-card.active {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}

	.artist-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.artist-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.artist-avatar span {
		color: white;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.artist-info {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.artist-name {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.artist-location {
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	.artist-bio {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
		margin-top: 2px;
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 48px 20px;
		text-align: center;
	}

	.empty-icon {
		font-size: 2rem;
		margin-bottom: 4px;
	}

	.empty-title {
		font-size: 0.95rem;
		font-weight: 600;
	}

	.empty-sub {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		line-height: 1.5;
		max-width: 260px;
	}

	/* Map markers */
	:global(.artist-marker) {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-primary);
		border: 2.5px solid white;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 700;
		font-size: 0.85rem;
		cursor: pointer;
		overflow: hidden;
		transition: transform 0.15s;
	}

	:global(.artist-marker:hover) {
		transform: scale(1.15);
	}

	:global(.artist-marker img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	:global(.mapboxgl-popup-content) {
		border-radius: 10px !important;
		padding: 14px 16px !important;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12) !important;
		min-width: 150px;
	}

	:global(.mapboxgl-popup-tip) {
		border-top-color: white !important;
	}
</style>
