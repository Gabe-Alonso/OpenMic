<script lang="ts">
	import { radiusToZoom } from '$lib/geo';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { onMount } from 'svelte';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import TagInput from '$lib/components/TagInput.svelte';

	let mapContainer: HTMLDivElement;
	let map: any = null;
	let mapboxgl: any = null;

	// Fetched fresh per viewport/radius from the server instead of loading
	// every discoverable artist on every page view — see src/routes/api/artists.
	let artists = $state<any[]>([]);
	let followerCounts = $state<Record<string, number>>({});
	let loadingArtists = $state(false);
	let hasLoadedOnce = $state(false);

	let activeArtistId = $state<string | null>(null);
	let tagFilter = $state<string[]>([]);
	let roleFilter = $state<string[]>([]);

	const ARTIST_ROLES = ['Instrumentalist', 'Producer', 'Composer', 'Sound Tech', 'Other'];

	function toggleRoleFilter(role: string) {
		if (roleFilter.includes(role)) {
			roleFilter = roleFilter.filter((r) => r !== role);
		} else {
			roleFilter = [...roleFilter, role];
		}
	}

	// Tag/role filters narrow the list only, same as before this change — the
	// map's dots and clusters reflect everything in view, not the filtered set.
	const displayArtists = $derived(
		artists.filter((a) => {
			if (tagFilter.length > 0 && !tagFilter.every((t) => ((a as any).tags ?? []).includes(t))) return false;
			if (roleFilter.length > 0) {
				const roles: string[] = (a as any).artist_roles ?? [];
				if (!roleFilter.some((r) => roles.includes(r))) return false;
			}
			return true;
		})
	);

	// Search state
	let searchInput = $state('');
	let searchSuggestions = $state<any[]>([]);
	let showSearchDropdown = $state(false);
	let searchLat = $state<number | null>(null);
	let searchLng = $state<number | null>(null);
	let searchRadius = $state(25);
	let debounceTimer: ReturnType<typeof setTimeout>;

	const RADIUS_OPTIONS = [10, 25, 50, 100, 250];

	function featuresFor(rows: any[]) {
		return rows.map((artist) => ({
			type: 'Feature' as const,
			geometry: { type: 'Point' as const, coordinates: [artist.location_lng, artist.location_lat] },
			properties: { id: artist.id, name: artist.full_name ?? 'Artist', location: artist.location ?? '' }
		}));
	}

	function updateMapSource() {
		const source = map?.getSource('artists');
		if (source) source.setData({ type: 'FeatureCollection', features: featuresFor(artists) });
	}

	// One fetch covers both modes this page supports: "what's in the current
	// map viewport" and "what's within N miles of a searched location."
	async function refreshArtists() {
		if (!map) return;
		loadingArtists = true;
		const params = new URLSearchParams();
		if (searchLat !== null && searchLng !== null) {
			params.set('lat', String(searchLat));
			params.set('lng', String(searchLng));
			params.set('radius', String(searchRadius));
		} else {
			const bounds = map.getBounds();
			params.set('minLat', String(bounds.getSouth()));
			params.set('maxLat', String(bounds.getNorth()));
			params.set('minLng', String(bounds.getWest()));
			params.set('maxLng', String(bounds.getEast()));
		}
		const res = await fetch(`/api/artists?${params}`);
		if (res.ok) {
			const json = await res.json();
			artists = json.artists ?? [];
			followerCounts = json.followerCounts ?? {};
			updateMapSource();
		}
		hasLoadedOnce = true;
		loadingArtists = false;
	}

	// Fits the map to the data once on load, using a lat/lng-only fetch (two
	// floats per row, not full profiles) so sizing the initial view doesn't
	// cost the same as rendering it.
	async function fitToExtent() {
		const res = await fetch('/api/artists?extent=true');
		if (!res.ok) return;
		const { points } = await res.json();
		if (!points || points.length === 0) return;
		if (points.length === 1) {
			map.jumpTo({ center: [points[0].location_lng, points[0].location_lat], zoom: 8 });
			return;
		}
		const bounds = new mapboxgl.LngLatBounds();
		for (const p of points) bounds.extend([p.location_lng, p.location_lat]);
		map.fitBounds(bounds, { padding: 80, maxZoom: 10, animate: false });
	}

	// Re-filter and re-center when radius changes while a location is active
	$effect(() => {
		const lat = searchLat;
		const lng = searchLng;
		const radius = searchRadius;
		if (lat !== null && lng !== null && map) {
			map.flyTo({ center: [lng, lat], zoom: radiusToZoom(radius) });
			refreshArtists();
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
		refreshArtists();
	}

	onMount(() => {
		let destroyed = false;

		(async () => {
			mapboxgl = (await import('mapbox-gl')).default;
			if (destroyed) return;
			mapboxgl.accessToken = PUBLIC_MAPBOX_TOKEN;

			map = new mapboxgl.Map({
				container: mapContainer,
				style: 'mapbox://styles/mapbox/light-v11',
				center: [-98, 39],
				zoom: 3.5
			});

			// Kick off data fetching now, in parallel with Mapbox's own style/tile
			// load, instead of waiting for the 'load' event first. map.getBounds()
			// only depends on center/zoom, which are set synchronously above, so
			// this doesn't need the map to have finished loading. The immediate
			// refreshArtists() paints cards fast using the default view; the
			// extent-fit corrects the viewport (and refetches) once we know the
			// data's real bounds.
			refreshArtists();
			fitToExtent().then(() => refreshArtists());

			map.on('load', () => {
			map.addSource('artists', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] },
				cluster: true,
				clusterMaxZoom: 14,
				clusterRadius: 50
			});
			updateMapSource();

			// Cluster bubbles
			map.addLayer({
				id: 'artist-clusters',
				type: 'circle',
				source: 'artists',
				filter: ['has', 'point_count'],
				paint: {
					'circle-color': '#7c3aed',
					'circle-radius': ['step', ['get', 'point_count'], 20, 10, 28, 50, 36],
					'circle-opacity': 0.9,
					'circle-stroke-width': 2.5,
					'circle-stroke-color': 'white'
				}
			});

			// Cluster count labels
			map.addLayer({
				id: 'artist-cluster-count',
				type: 'symbol',
				source: 'artists',
				filter: ['has', 'point_count'],
				layout: {
					'text-field': '{point_count_abbreviated}',
					'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
					'text-size': 13
				},
				paint: { 'text-color': 'white' }
			});

			// Individual artist dots — selected point gets a deeper fill and a larger halo
			map.addLayer({
				id: 'artist-points',
				type: 'circle',
				source: 'artists',
				filter: ['!', ['has', 'point_count']],
				paint: {
					'circle-color': ['case', ['==', ['get', 'id'], activeArtistId ?? ''], '#4c1d95', '#7c3aed'],
					'circle-radius': ['case', ['==', ['get', 'id'], activeArtistId ?? ''], 14, 10],
					'circle-stroke-width': ['case', ['==', ['get', 'id'], activeArtistId ?? ''], 4, 2.5],
					'circle-stroke-color': 'white'
				}
			});

			// Zoom into cluster on click
			map.on('click', 'artist-clusters', (e: any) => {
				const clusterFeatures = map.queryRenderedFeatures(e.point, { layers: ['artist-clusters'] });
				const clusterId = clusterFeatures[0].properties.cluster_id;
				(map.getSource('artists') as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
					if (err) return;
					map.easeTo({ center: (clusterFeatures[0].geometry as any).coordinates, zoom });
				});
			});

			// Show popup and scroll card on individual artist click
			map.on('click', 'artist-points', (e: any) => {
				const props = e.features[0].properties;
				const coords = (e.features[0].geometry as any).coordinates.slice();
				const popupHtml = `
					<strong style="font-family:'DM Sans',system-ui,sans-serif;font-size:0.9rem;font-weight:700;display:block;color:#17082f;">${props.name}</strong>
					${props.location ? `<span style="font-family:'DM Sans',system-ui,sans-serif;font-size:0.78rem;color:#5b4f78;display:block;margin:2px 0 8px;">${props.location}</span>` : '<div style="margin-bottom:8px;"></div>'}
					<a href="/profile/${props.id}" style="font-family:'DM Sans',system-ui,sans-serif;font-size:0.8rem;color:#4c1d95;font-weight:700;text-decoration:none;">View Profile →</a>
				`;
				new mapboxgl.Popup({ offset: 15, closeButton: false })
					.setLngLat(coords)
					.setHTML(popupHtml)
					.addTo(map);
				activeArtistId = props.id;
				map.setPaintProperty('artist-points', 'circle-color', ['case', ['==', ['get', 'id'], props.id], '#4c1d95', '#7c3aed']);
				map.setPaintProperty('artist-points', 'circle-radius', ['case', ['==', ['get', 'id'], props.id], 14, 10]);
				map.setPaintProperty('artist-points', 'circle-stroke-width', ['case', ['==', ['get', 'id'], props.id], 4, 2.5]);
				document.getElementById(`artist-${props.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			});

			// Pointer cursor on hover
			['artist-clusters', 'artist-points'].forEach((layer) => {
				map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
				map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
			});

		});

			map.on('moveend', () => { if (searchLat === null && hasLoadedOnce) refreshArtists(); });
		})();

		return () => {
			destroyed = true;
			map?.remove();
		};
	});
</script>

<div class="artists-page">
	<div class="map-wrap">
		<div class="map-panel" bind:this={mapContainer}></div>
		<div class="zoom-controls">
			<button class="zoom-btn" type="button" aria-label="Zoom in" onclick={() => map?.zoomIn()}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
			</button>
			<button class="zoom-btn" type="button" aria-label="Zoom out" onclick={() => map?.zoomOut()}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>
			</button>
		</div>
	</div>

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
			<div class="tag-filter-row">
				<TagInput tags={tagFilter} ontags={(t) => (tagFilter = t)} placeholder="Filter by tag…" />
			</div>
			<div class="role-filter-row">
				{#each ARTIST_ROLES as role}
					<button
						type="button"
						class="role-filter-chip"
						class:role-filter-chip-active={roleFilter.includes(role)}
						onclick={() => toggleRoleFilter(role)}
					>{role}</button>
				{/each}
			</div>
		</div>

		<div class="list-header">
			<h1>Artists</h1>
			<p>
				{#if loadingArtists}
					Loading…
				{:else}
					{displayArtists.length}
					{displayArtists.length === 1 ? 'artist' : 'artists'}
					{searchLat !== null ? `within ${searchRadius} miles` : 'in view'}
					{tagFilter.length > 0 ? `matching ${tagFilter.length === 1 ? 'tag' : 'tags'}` : ''}
				{/if}
			</p>
		</div>

		<div class="artist-list">
			{#if !hasLoadedOnce}
				<div class="empty-state">
					<svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"/></svg>
				</div>
			{:else if displayArtists.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🗺️</span>
					<p class="empty-title">No artists found</p>
					<p class="empty-sub">
						{tagFilter.length > 0
							? 'No artists match those tags in this area. Try removing a tag or expanding your search.'
							: searchLat !== null
								? 'Try increasing the radius or searching a different location.'
								: 'Try zooming out or panning the map.'}
					</p>
				</div>
			{:else}
				{#each displayArtists as artist (artist.id)}
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
							<p class="artist-followers">{followerCounts[artist.id] ?? 0} followers</p>
							{#if artist.location}
								<p class="artist-location">{artist.location}</p>
							{/if}
							{#if artist.bio}
								<p class="artist-bio">{artist.bio}</p>
							{/if}
							{#if (artist as any).artist_roles?.length > 0}
								<div class="artist-roles">
									{#each (artist as any).artist_roles as role}
										<span class="artist-role">{role}</span>
									{/each}
								</div>
							{/if}
							{#if (artist as any).tags?.length > 0}
								<div class="artist-tags">
									{#each (artist as any).tags as tag}
										<span class="artist-tag">#{tag}</span>
									{/each}
								</div>
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

	.map-wrap {
		position: relative;
		flex: 1;
		min-width: 0;
	}

	.map-panel {
		width: 100%;
		height: 100%;
	}

	.zoom-controls {
		position: absolute;
		top: 18px;
		right: 18px;
		z-index: 5;
		display: flex;
		flex-direction: column;
		border-radius: 16px;
		overflow: hidden;
		background: var(--color-surface);
		box-shadow: 0 8px 20px rgba(23, 8, 47, 0.18);
	}

	.zoom-btn {
		width: 44px;
		height: 44px;
		border: none;
		background: none;
		color: var(--color-ink);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.12s;
	}

	.zoom-btn:first-child {
		border-bottom: 1px solid var(--color-border);
	}

	.zoom-btn:hover {
		background: var(--color-primary-light);
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
		padding: 11px 32px 11px 34px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-pill);
		font-size: 0.875rem;
		background: var(--color-surface-tint);
		color: var(--color-text);
		outline: none;
		font-family: inherit;
		transition: border-color 0.15s, box-shadow 0.15s;
		box-sizing: border-box;
	}

	.search-input:focus {
		border-color: var(--color-primary);
		background: var(--color-surface);
		box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.35);
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
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-input);
		box-shadow: var(--shadow-card-hover);
		z-index: 200;
		list-style: none;
		margin: 0;
		padding: 6px;
	}

	.search-dropdown li {
		list-style: none;
	}

	.search-dropdown button {
		width: 100%;
		min-height: 44px;
		text-align: left;
		background: none;
		border: none;
		padding: 8px 14px;
		border-radius: var(--radius-md);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1px;
		transition: background 0.1s;
	}

	.search-dropdown button:hover {
		background: var(--color-primary-light);
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
		padding: 9px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-pill);
		font-size: 0.875rem;
		background: var(--color-surface-tint);
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

	.tag-filter-row {
		margin-top: 8px;
	}

	.role-filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}

	.role-filter-chip {
		padding: 5px 13px;
		border-radius: var(--radius-pill);
		border: 1.5px solid var(--color-border);
		background: var(--color-surface-tint);
		color: var(--color-text-muted);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.12s, background 0.12s, color 0.12s;
		font-family: inherit;
	}

	.role-filter-chip:hover {
		border-color: var(--color-lilac);
		color: var(--color-primary-deep);
		background: var(--color-primary-light);
	}

	.role-filter-chip-active {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-cream);
	}

	.role-filter-chip-active:hover {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-cream);
	}

	/* List header */
	.list-header {
		padding: 18px 20px 14px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.list-header h1 {
		font-size: 1.25rem;
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
		gap: 14px;
		padding: 16px;
		border-radius: 22px;
		border: 1.5px solid var(--color-border);
		background: var(--color-surface);
		text-decoration: none;
		color: var(--color-text);
		transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
	}

	.artist-card:hover,
	.artist-card.active {
		border-color: var(--color-lilac);
		box-shadow: var(--shadow-card-hover);
		transform: translateY(-2px);
	}

	.artist-avatar {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--color-primary-deep);
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
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.375rem;
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

	.artist-followers {
		font-size: 0.75rem;
		color: var(--color-text-muted);
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

	.artist-roles {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
	}

	.artist-role {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-cream);
		background: var(--color-ink);
		border-radius: 999px;
		padding: 3px 10px;
	}

	.artist-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
	}

	.artist-tag {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-primary-deep);
		background: var(--color-primary-light);
		border-radius: 999px;
		padding: 2px 8px;
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

	.spin {
		animation: spin 0.8s linear infinite;
		color: var(--color-text-muted);
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.empty-icon {
		font-size: 2rem;
		margin-bottom: 4px;
	}

	.empty-title {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 800;
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
		background: var(--color-primary-bright);
		border: 2.5px solid white;
		box-shadow: 0 2px 8px rgba(76, 29, 149, 0.3);
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
		border-radius: 18px !important;
		padding: 14px 16px !important;
		box-shadow: var(--shadow-card-hover) !important;
		border: 1px solid var(--color-border-soft);
		min-width: 150px;
	}

	:global(.mapboxgl-popup-tip) {
		border-top-color: white !important;
	}

	@media (max-width: 768px) {
		.artists-page {
			flex-direction: column;
			height: auto;
			overflow: visible;
			margin: -16px -12px;
		}

		.map-wrap {
			height: 50vh;
			flex: none;
		}

		.list-panel {
			width: 100%;
			flex: none;
			border-left: none;
			border-top: 1px solid var(--color-border);
			overflow: visible;
		}

		.artist-list {
			overflow-y: visible;
			flex: none;
		}
	}
</style>
