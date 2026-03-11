<script lang="ts">
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
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
		visibleVenues = allVenues.filter((v) => bounds.contains([getLng(v), getLat(v)]));
	}

	function filterByRadius(lat: number, lng: number, radius: number) {
		visibleVenues = allVenues.filter(
			(v) => distanceMiles(lat, lng, getLat(v), getLng(v)) <= radius
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

		allVenues.forEach((venue) => {
			const lat = getLat(venue);
			const lng = getLng(venue);
			if (!lat || !lng) return;

			const el = document.createElement('div');
			if (venue._source === 'registered') {
				el.className = 'venue-marker registered-marker';
				if (venue.avatar_url) {
					el.innerHTML = `<img src="${venue.avatar_url}" alt="${venue.full_name ?? ''}" />`;
				} else {
					el.textContent = (venue.full_name?.[0] ?? '?').toUpperCase();
				}
			} else {
				el.className = 'venue-marker seeded-marker';
				el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
			}

			const displayName = venue._source === 'registered' ? (venue.full_name ?? 'Venue') : venue.name;
			const displayLoc = venue._source === 'registered' ? (venue.location ?? '') : [venue.address, venue.city].filter(Boolean).join(', ');

			const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
				<strong style="font-size:0.875rem;font-weight:600;display:block;">${displayName}</strong>
				${displayLoc ? `<span style="font-size:0.78rem;color:#71717a;display:block;margin:2px 0 8px;">${displayLoc}</span>` : '<div style="margin-bottom:8px;"></div>'}
				${venue._source === 'registered'
					? `<a href="/profile/${venue.id}" style="font-size:0.8rem;color:#7c3aed;font-weight:500;text-decoration:none;">View Profile →</a>`
					: venue.claimed_profile_id
						? `<span style="font-size:0.78rem;color:#16a34a;font-weight:600;">✓ Claimed</span>`
						: `<a href="/venues/${venue.id}/claim" style="font-size:0.8rem;color:#7c3aed;font-weight:500;text-decoration:none;">Claim this venue →</a>`
				}
			`);

			new mapboxgl.Marker({ element: el })
				.setLngLat([lng, lat])
				.setPopup(popup)
				.addTo(map);

			el.addEventListener('click', () => {
				activeVenueId = venue._id;
				document.getElementById(`venue-${venue._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			});
		});

		if (allVenues.length === 1) {
			const v = allVenues[0];
			map.flyTo({ center: [getLng(v), getLat(v)], zoom: 8 });
		} else if (allVenues.length > 1) {
			const bounds = new mapboxgl.LngLatBounds();
			allVenues.forEach((v) => bounds.extend([getLng(v), getLat(v)]));
			map.fitBounds(bounds, { padding: 80, maxZoom: 10 });
		}

		map.on('load', () => { if (searchLat === null) filterByBounds(); });
		map.on('moveend', () => { if (searchLat === null) filterByBounds(); });

		return () => map.remove();
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
				{visibleVenues.length}
				{visibleVenues.length === 1 ? 'venue' : 'venues'}
				{searchLat !== null ? `within ${searchRadius} miles` : 'in view'}
			</p>
		</div>

		<div class="venue-list">
			{#if allVenues.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🏛️</span>
					<p class="empty-title">No venues yet</p>
					<p class="empty-sub">Venues will appear here once they set their location or are imported from the map.</p>
				</div>
			{:else if visibleVenues.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🗺️</span>
					<p class="empty-title">No venues found</p>
					<p class="empty-sub">Try zooming out, expanding the radius, or searching a different location.</p>
				</div>
			{:else}
				{#each visibleVenues as venue (venue._id)}
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

	/* Map markers */
	:global(.venue-marker) {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 2.5px solid white;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.85rem;
		cursor: pointer;
		overflow: hidden;
		transition: transform 0.15s;
	}

	:global(.venue-marker:hover) { transform: scale(1.15); }

	:global(.registered-marker) {
		background: var(--color-primary);
		color: white;
	}

	:global(.registered-marker img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	:global(.seeded-marker) {
		background: #e5e7eb;
		color: #6b7280;
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
