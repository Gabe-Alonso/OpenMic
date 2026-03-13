<script lang="ts">
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import TagInput from '$lib/components/TagInput.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mapContainer: HTMLDivElement;
	let map: any = null;
	let activeVenueId = $state<string | null>(null);
	let importing = $state(false);
	let importMsg = $state<string | null>(null);

	// Merge registered + seeded into a unified list
	const allVenues = $derived([
		...(data.registeredVenues as any[]).map((v) => ({ ...v, _source: 'registered', _id: v.id })),
		...(data.seededVenues as any[]).map((v) => ({ ...v, _source: 'seeded', _id: v.id }))
	]);

	let visibleVenues = $state<any[]>([]);
	let claimedOnly = $state(false);
	let tagFilter = $state<string[]>([]);

	const displayVenues = $derived(
		tagFilter.length === 0
			? visibleVenues
			: visibleVenues.filter((v) => tagFilter.every((t) => ((v as any).tags ?? []).includes(t)))
	);

	function isClaimed(v: any): boolean {
		return v._source === 'registered' || !!v.claimed_profile_id;
	}

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

	function getLat(v: any): number {
		return v._source === 'registered' ? v.location_lat : v.lat;
	}

	function getLng(v: any): number {
		return v._source === 'registered' ? v.location_lng : v.lng;
	}

	function filterByBounds() {
		if (!map) return;
		const bounds = map.getBounds();
		visibleVenues = allVenues.filter(
			(v) => bounds.contains([getLng(v), getLat(v)]) && (!claimedOnly || isClaimed(v))
		);
	}

	function filterByRadius(lat: number, lng: number, radius: number) {
		visibleVenues = allVenues.filter(
			(v) => distanceMiles(lat, lng, getLat(v), getLng(v)) <= radius && (!claimedOnly || isClaimed(v))
		);
	}

	$effect(() => {
		const lat = searchLat;
		const lng = searchLng;
		const radius = searchRadius;
		if (lat !== null && lng !== null) {
			filterByRadius(lat, lng, radius);
			map?.flyTo({ center: [lng, lat], zoom: radiusToZoom(radius) });
		}
	});

	$effect(() => {
		// Re-filter whenever claimedOnly changes
		void claimedOnly;
		if (searchLat !== null && searchLng !== null) {
			filterByRadius(searchLat, searchLng, searchRadius);
		} else {
			filterByBounds();
		}
	});

	async function fetchSearchSuggestions(q: string) {
		if (q.length < 2) { searchSuggestions = []; showSearchDropdown = false; return; }
		const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&types=place,region&access_token=${PUBLIC_MAPBOX_TOKEN}&limit=5`;
		const res = await fetch(url);
		const json = await res.json();
		searchSuggestions = json.features ?? [];
		showSearchDropdown = searchSuggestions.length > 0;
	}

	function onSearchInput(e: Event) {
		const q = (e.currentTarget as HTMLInputElement).value;
		searchInput = q;
		searchLat = null;
		searchLng = null;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => fetchSearchSuggestions(q), 300);
	}

	function selectSearchLocation(feature: any) {
		searchInput = feature.properties.full_address ?? feature.properties.name;
		searchLng = feature.geometry.coordinates[0];
		searchLat = feature.geometry.coordinates[1];
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

	async function importVenues() {
		if (!map || importing) return;
		importing = true;
		importMsg = null;
		const center = map.getCenter();
		const res = await fetch('/api/admin/seed-venues', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ lat: center.lat, lng: center.lng, radius_km: searchRadius * 1.60934 })
		});
		if (res.ok) {
			const { inserted } = await res.json();
			importMsg = `Imported ${inserted} venue${inserted === 1 ? '' : 's'}.`;
			await invalidateAll();
		} else {
			importMsg = 'Import failed.';
		}
		importing = false;
		setTimeout(() => { importMsg = null; }, 4000);
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

		// Build GeoJSON features once — avoids 1000+ DOM markers
		const features = allVenues
			.map((venue) => {
				const lat = getLat(venue);
				const lng = getLng(venue);
				if (!lat || !lng) return null;
				const displayName = venue._source === 'registered' ? (venue.full_name ?? 'Venue') : venue.name;
				const displayLoc = venue._source === 'registered'
					? (venue.location ?? '')
					: [venue.address, venue.city].filter(Boolean).join(', ');
				return {
					type: 'Feature' as const,
					geometry: { type: 'Point' as const, coordinates: [lng, lat] },
					properties: {
						_id: venue._id,
						_source: venue._source,
						id: venue.id,
						name: displayName,
						location: displayLoc,
						claimed_profile_id: venue.claimed_profile_id ?? null
					}
				};
			})
			.filter(Boolean) as any[];

		map.on('load', () => {
			if (searchLat === null) filterByBounds();

			map.addSource('venues', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features },
				cluster: true,
				clusterMaxZoom: 14,
				clusterRadius: 50
			});

			// Cluster bubbles
			map.addLayer({
				id: 'venue-clusters',
				type: 'circle',
				source: 'venues',
				filter: ['has', 'point_count'],
				paint: {
					'circle-color': '#7c3aed',
					'circle-radius': ['step', ['get', 'point_count'], 20, 10, 28, 50, 36],
					'circle-opacity': 0.88,
					'circle-stroke-width': 2.5,
					'circle-stroke-color': 'white'
				}
			});

			// Cluster count labels
			map.addLayer({
				id: 'venue-cluster-count',
				type: 'symbol',
				source: 'venues',
				filter: ['has', 'point_count'],
				layout: {
					'text-field': '{point_count_abbreviated}',
					'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
					'text-size': 13
				},
				paint: { 'text-color': 'white' }
			});

			// Individual registered venues (purple dot)
			map.addLayer({
				id: 'venue-registered',
				type: 'circle',
				source: 'venues',
				filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', '_source'], 'registered']],
				paint: {
					'circle-color': '#7c3aed',
					'circle-radius': 10,
					'circle-stroke-width': 2.5,
					'circle-stroke-color': 'white'
				}
			});

			// Individual seeded venues (gray dot)
			map.addLayer({
				id: 'venue-seeded',
				type: 'circle',
				source: 'venues',
				filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', '_source'], 'seeded']],
				paint: {
					'circle-color': '#9ca3af',
					'circle-radius': 10,
					'circle-stroke-width': 2.5,
					'circle-stroke-color': 'white'
				}
			});

			// Zoom into cluster on click
			map.on('click', 'venue-clusters', (e: any) => {
				const clusterFeatures = map.queryRenderedFeatures(e.point, { layers: ['venue-clusters'] });
				const clusterId = clusterFeatures[0].properties.cluster_id;
				(map.getSource('venues') as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
					if (err) return;
					map.easeTo({ center: (clusterFeatures[0].geometry as any).coordinates, zoom });
				});
			});

			// Show popup and scroll card on individual venue click
			['venue-registered', 'venue-seeded'].forEach((layer) => {
				map.on('click', layer, (e: any) => {
					const props = e.features[0].properties;
					const coords = (e.features[0].geometry as any).coordinates.slice();
					const popupHtml = `
						<strong style="font-size:0.875rem;font-weight:600;display:block;">${props.name}</strong>
						${props.location ? `<span style="font-size:0.78rem;color:#71717a;display:block;margin:2px 0 8px;">${props.location}</span>` : '<div style="margin-bottom:8px;"></div>'}
						${props._source === 'registered'
							? `<a href="/profile/${props.id}" style="font-size:0.8rem;color:#7c3aed;font-weight:500;text-decoration:none;">View Profile →</a>`
							: props.claimed_profile_id
								? `<span style="font-size:0.78rem;color:#16a34a;font-weight:600;">✓ Claimed</span>`
								: `<a href="/venues/${props.id}/claim" style="font-size:0.8rem;color:#7c3aed;font-weight:500;text-decoration:none;">Claim this venue →</a>`
						}
					`;
					new mapboxgl.Popup({ offset: 15, closeButton: false })
						.setLngLat(coords)
						.setHTML(popupHtml)
						.addTo(map);
					activeVenueId = props._id;
					document.getElementById(`venue-${props._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
				});
			});

			// Pointer cursor on hover
			['venue-clusters', 'venue-registered', 'venue-seeded'].forEach((layer) => {
				map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
				map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
			});

			// Fit to all venues after map is ready
			if (allVenues.length === 1) {
				const v = allVenues[0];
				map.flyTo({ center: [getLng(v), getLat(v)], zoom: 8 });
			} else if (allVenues.length > 1) {
				const bounds = new mapboxgl.LngLatBounds();
				allVenues.forEach((v) => bounds.extend([getLng(v), getLat(v)]));
				map.fitBounds(bounds, { padding: 80, maxZoom: 10 });
			}
		});

		map.on('moveend', () => { if (searchLat === null) filterByBounds(); });

		onDestroy(() => map.remove());
	});
</script>

<div class="venues-page">
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

			<div class="tag-filter-row">
			<TagInput tags={tagFilter} ontags={(t) => (tagFilter = t)} placeholder="Filter by tag…" />
		</div>

		<label class="claimed-toggle">
			<input type="checkbox" bind:checked={claimedOnly} />
			<span class="toggle-track"><span class="toggle-thumb"></span></span>
			Claimed accounts only
		</label>

		{#if data.isAdmin}
				<div class="admin-row">
					<button class="import-btn" onclick={importVenues} disabled={importing}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
							<path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
						</svg>
						{importing ? 'Importing…' : 'Import venues in this area'}
					</button>
					{#if importMsg}
						<span class="import-msg">{importMsg}</span>
					{/if}
				</div>
			{/if}
		</div>

		<div class="list-header">
			<h1>Venues</h1>
			<p>
				{displayVenues.length}
				{displayVenues.length === 1 ? 'venue' : 'venues'}
				{searchLat !== null ? `within ${searchRadius} miles` : 'in view'}
				{tagFilter.length > 0 ? `matching ${tagFilter.length === 1 ? 'tag' : 'tags'}` : ''}
			</p>
		</div>

		<div class="venue-list">
			{#if allVenues.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🏛️</span>
					<p class="empty-title">No venues yet</p>
					<p class="empty-sub">Venues will appear here once they set their location or are imported from the map.</p>
				</div>
			{:else if displayVenues.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🗺️</span>
					<p class="empty-title">No venues found</p>
					<p class="empty-sub">
						{tagFilter.length > 0
							? 'No venues match those tags in this area. Try removing a tag or expanding your search.'
							: 'Try zooming out, expanding the radius, or searching a different location.'}
					</p>
				</div>
			{:else}
				{#each displayVenues as venue (venue._id)}
					{#if venue._source === 'registered'}
						<a
							href="/profile/{venue.id}"
							id="venue-{venue._id}"
							class="venue-card"
							class:active={activeVenueId === venue._id}
						>
							<div class="venue-avatar registered-avatar">
								{#if venue.avatar_url}
									<img src={venue.avatar_url} alt={venue.full_name ?? ''} />
								{:else}
									<span>{(venue.full_name?.[0] ?? '?').toUpperCase()}</span>
								{/if}
							</div>
							<div class="venue-info">
								<div class="venue-name-row">
									<p class="venue-name">{venue.full_name ?? 'Unnamed Venue'}</p>
									<span class="badge registered-badge">Registered</span>
								</div>
								{#if venue.location}
									<p class="venue-location">{venue.location}</p>
								{/if}
								{#if venue.bio}
									<p class="venue-bio">{venue.bio}</p>
								{/if}
								{#if venue.tags?.length > 0}
									<div class="venue-tags">
										{#each venue.tags as tag}
											<span class="venue-tag">#{tag}</span>
										{/each}
									</div>
								{/if}
							</div>
						</a>
					{:else}
						<div
							id="venue-{venue._id}"
							class="venue-card"
							class:active={activeVenueId === venue._id}
						>
							<div class="venue-avatar seeded-avatar">
								<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
									<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
									<polyline points="9 22 9 12 15 12 15 22"/>
								</svg>
							</div>
							<div class="venue-info">
								<div class="venue-name-row">
									<p class="venue-name">{venue.name}</p>
									{#if venue.claimed_profile_id}
										<span class="badge claimed-badge">Claimed</span>
									{/if}
								</div>
								{#if venue.address || venue.city}
									<p class="venue-location">{[venue.address, venue.city].filter(Boolean).join(', ')}</p>
								{/if}
								{#if venue.venue_types?.length > 0}
									<div class="venue-types">
										{#each venue.venue_types as type}
											<span class="venue-type">{type.replace(/_/g, ' ')}</span>
										{/each}
									</div>
								{/if}
								{#if venue.website}
									<a href={venue.website} target="_blank" rel="noopener" class="venue-website">{venue.website.replace(/^https?:\/\//, '')}</a>
								{/if}
								{#if venue.phone}
									<p class="venue-phone">{venue.phone}</p>
								{/if}
								{#if !venue.claimed_profile_id}
									<a href="/venues/{venue.id}/claim" class="claim-btn">Claim this venue</a>
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.venues-page {
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

	.search-input:focus { border-color: var(--color-primary); background: var(--color-surface); }
	.search-input::placeholder { color: var(--color-text-muted); opacity: 0.7; }

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
	}

	.clear-btn:hover { color: var(--color-text); }

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

	.search-dropdown li { list-style: none; }

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

	.search-dropdown button:hover { background: var(--color-bg); }

	.place-name { font-size: 0.85rem; font-weight: 500; color: var(--color-text); }
	.place-detail { font-size: 0.75rem; color: var(--color-text-muted); }

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

	.radius-select:not(:disabled):focus { border-color: var(--color-primary); }
	.radius-select:disabled { opacity: 0.45; cursor: default; }

	.tag-filter-row {
		margin-top: 8px;
	}

	.claimed-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		user-select: none;
	}

	.claimed-toggle input {
		display: none;
	}

	.toggle-track {
		width: 32px;
		height: 18px;
		border-radius: 999px;
		background: var(--color-border);
		position: relative;
		flex-shrink: 0;
		transition: background 0.2s;
	}

	.claimed-toggle input:checked ~ .toggle-track {
		background: var(--color-primary);
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: white;
		transition: transform 0.2s;
		box-shadow: 0 1px 3px rgba(0,0,0,0.2);
	}

	.claimed-toggle input:checked ~ .toggle-track .toggle-thumb {
		transform: translateX(14px);
	}

	.admin-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
	}

	.import-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		border-radius: var(--radius-sm);
		background: var(--color-primary-light);
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s;
		white-space: nowrap;
	}

	.import-btn:hover:not(:disabled) { background: #ede9fe; }
	.import-btn:disabled { opacity: 0.6; cursor: default; }

	.import-msg {
		font-size: 0.8rem;
		color: var(--color-text-muted);
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

	.venue-list {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* Venue cards */
	.venue-card {
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

	.venue-card:hover,
	.venue-card.active {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}

	.venue-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.registered-avatar {
		background: var(--color-primary);
	}

	.registered-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.registered-avatar span {
		color: white;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.seeded-avatar {
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		color: var(--color-text-muted);
	}

	.venue-info {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		flex: 1;
	}

	.venue-name-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.venue-name {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.badge {
		font-size: 0.68rem;
		font-weight: 700;
		border-radius: 999px;
		padding: 2px 8px;
		white-space: nowrap;
	}

	.registered-badge {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.claimed-badge {
		background: #dcfce7;
		color: #16a34a;
	}

	.venue-location {
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	.venue-bio {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
		margin-top: 2px;
	}

	.venue-types {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 2px;
	}

	.venue-type {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-text-muted);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		padding: 2px 8px;
		text-transform: capitalize;
	}

	.venue-website {
		font-size: 0.78rem;
		color: var(--color-primary);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.venue-website:hover { text-decoration: underline; }

	.venue-phone {
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	.venue-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
	}

	.venue-tag {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-primary);
		background: var(--color-primary-light);
		border-radius: 999px;
		padding: 2px 8px;
	}

	.claim-btn {
		display: inline-block;
		margin-top: 6px;
		padding: 5px 12px;
		border-radius: var(--radius-sm);
		background: var(--color-primary);
		color: white;
		font-size: 0.78rem;
		font-weight: 600;
		text-decoration: none;
		transition: background 0.12s;
		align-self: flex-start;
	}

	.claim-btn:hover { background: var(--color-primary-dark); }

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 48px 20px;
		text-align: center;
	}

	.empty-icon { font-size: 2rem; margin-bottom: 4px; }
	.empty-title { font-size: 0.95rem; font-weight: 600; }
	.empty-sub { font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.5; max-width: 260px; }

	:global(.mapboxgl-popup-content) {
		border-radius: 10px !important;
		padding: 14px 16px !important;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12) !important;
		min-width: 150px;
	}

	:global(.mapboxgl-popup-tip) {
		border-top-color: white !important;
	}

	@media (max-width: 768px) {
		.venues-page {
			flex-direction: column;
			height: auto;
			overflow: visible;
			margin: -16px -12px;
		}

		.map-panel {
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

		.venue-list {
			overflow-y: visible;
			flex: none;
		}
	}
</style>
