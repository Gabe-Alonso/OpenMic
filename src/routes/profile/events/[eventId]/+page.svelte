<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Supabase-js's select-string type inference can't tell a to-one embed
	// (via a FK on this row) from a to-many one, so it types every embed as
	// an array regardless of actual cardinality; the real runtime shape here
	// is a single nested object (or null), per the FK on each table.
	type ArtistRef = { id: string; full_name: string | null; avatar_url: string | null } | null;
	type Application = {
		id: string;
		message: string | null;
		status: 'pending' | 'accepted' | 'rejected';
		created_at: string;
		artist: ArtistRef;
	};
	type Offer = {
		id: string;
		message: string | null;
		status: 'pending' | 'accepted' | 'declined' | 'cancelled';
		created_at: string;
		artist: ArtistRef;
	};
	type Slot = {
		id: string;
		start_time: string | null;
		end_time: string | null;
		status: 'open' | 'reserved' | 'filled';
		filled_at: string | null;
		artist: ArtistRef;
		applications: Application[];
		offers: Offer[];
	};

	const slots = $derived((data.slots ?? []) as unknown as Slot[]);

	function formatTime(t: string | null): string {
		if (!t) return '';
		const [h, m] = t.split(':').map(Number);
		const period = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 === 0 ? 12 : h % 12;
		return `${h12}:${String(m).padStart(2, '0')} ${period}`;
	}

	function slotLabel(s: Slot): string {
		if (!s.start_time) return 'Time TBD';
		return s.end_time ? `${formatTime(s.start_time)} – ${formatTime(s.end_time)}` : formatTime(s.start_time);
	}

	function pendingOffer(s: Slot): Offer | undefined {
		return s.offers.find((o) => o.status === 'pending');
	}

	function pendingApplications(s: Slot): Application[] {
		return s.applications.filter((a) => a.status === 'pending');
	}

	function decidedApplications(s: Slot): Application[] {
		return s.applications.filter((a) => a.status !== 'pending');
	}

	let dmLoading = $state(false);
	async function openDM(artistId: string) {
		if (dmLoading) return;
		dmLoading = true;
		try {
			const res = await fetch('/api/messages/conversations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ other_user_id: artistId })
			});
			if (res.status === 401) { goto('/signin'); return; }
			if (res.ok) {
				const { conversationId } = await res.json();
				goto(`/messages/${conversationId}`);
			}
		} finally {
			dmLoading = false;
		}
	}

	let addingSlot = $state(false);
	let newStartTime = $state('');
	let newEndTime = $state('');

	// Which slot (by id) currently has its "invite an artist" picker open.
	let invitingSlotId = $state<string | null>(null);
	let artistQuery = $state('');
	let artistResults = $state<{ id: string; full_name: string | null; avatar_url: string | null }[]>([]);
	let selectedArtist = $state<{ id: string; full_name: string | null } | null>(null);
	let offerMessage = $state('');
	let searching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	function openInvite(slotId: string) {
		invitingSlotId = invitingSlotId === slotId ? null : slotId;
		artistQuery = '';
		artistResults = [];
		selectedArtist = null;
		offerMessage = '';
	}

	function onArtistQueryInput() {
		selectedArtist = null;
		if (searchTimer) clearTimeout(searchTimer);
		const q = artistQuery.trim();
		if (q.length < 2) {
			artistResults = [];
			return;
		}
		searchTimer = setTimeout(async () => {
			searching = true;
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
				if (res.ok) {
					const body = await res.json();
					artistResults = (body.profiles ?? []).filter((p: any) => p.profile_type === 'artist');
				}
			} finally {
				searching = false;
			}
		}, 300);
	}

	function pickArtist(a: { id: string; full_name: string | null }) {
		selectedArtist = a;
		artistResults = [];
		artistQuery = a.full_name ?? '';
	}
</script>

<div class="manage-page">
	<a href="/profile" class="back-link">← Back to your profile</a>

	<div class="card">
		<h1 class="event-title">{data.event.title}</h1>
		<p class="event-date">{data.event.date}</p>
		{#if data.event.description}<p class="event-desc">{data.event.description}</p>{/if}
	</div>

	<div class="card">
		<div class="section-header">
			<h2 class="card-title">Slots</h2>
			<button type="button" class="new-btn" onclick={() => (addingSlot = !addingSlot)}>
				{addingSlot ? 'Cancel' : '+ Add Slot'}
			</button>
		</div>

		{#if form && 'slotError' in form && form.slotError}
			<p class="error-banner" role="alert">{form.slotError}</p>
		{/if}

		{#if addingSlot}
			<form
				method="POST"
				action="?/addSlot"
				use:enhance={() => async ({ update }) => { await update(); addingSlot = false; newStartTime = ''; newEndTime = ''; }}
				class="add-slot-form"
			>
				<div class="form-field">
					<label for="new-start">Start time (optional)</label>
					<input id="new-start" type="time" name="start_time" bind:value={newStartTime} />
				</div>
				<div class="form-field">
					<label for="new-end">End time (optional)</label>
					<input id="new-end" type="time" name="end_time" bind:value={newEndTime} />
				</div>
				<button type="submit" class="btn btn-primary">Add Slot</button>
			</form>
		{/if}

		{#if slots.length === 0}
			<p class="empty-hint">No slots yet. Add one so artists can apply.</p>
		{/if}

		<div class="slot-list">
			{#each slots as slot (slot.id)}
				{@const offer = pendingOffer(slot)}
				{@const pending = pendingApplications(slot)}
				{@const decided = decidedApplications(slot)}
				<div class="slot-card">
					<div class="slot-head">
						<span class="slot-time">{slotLabel(slot)}</span>
						<span class="slot-status slot-status-{slot.status}">
							{slot.status === 'open' ? 'Open' : slot.status === 'reserved' ? 'Private offer pending' : 'Filled'}
						</span>
						{#if slot.status !== 'filled'}
							<form method="POST" action="?/deleteSlot" use:enhance class="delete-slot-form">
								<input type="hidden" name="slot_id" value={slot.id} />
								<button type="submit" class="del-slot-btn" aria-label="Delete slot">Delete</button>
							</form>
						{/if}
					</div>

					{#if slot.status === 'filled' && slot.artist}
						<a href="/profile/{slot.artist.id}" class="filled-artist">
							<span class="avatar">
								{#if slot.artist.avatar_url}
									<img src={slot.artist.avatar_url} alt="" />
								{:else}
									{slot.artist.full_name?.[0]?.toUpperCase() ?? '?'}
								{/if}
							</span>
							<span>{slot.artist.full_name ?? 'Artist'} is locked in for this slot.</span>
						</a>
					{/if}

					{#if offer}
						<div class="offer-row">
							<a href="/profile/{offer.artist?.id}" class="applicant-person">
								<span class="avatar">
									{#if offer.artist?.avatar_url}
										<img src={offer.artist.avatar_url} alt="" />
									{:else}
										{offer.artist?.full_name?.[0]?.toUpperCase() ?? '?'}
									{/if}
								</span>
								<span class="applicant-name">{offer.artist?.full_name ?? 'Artist'}</span>
							</a>
							<span class="offer-label">Private offer sent — awaiting response</span>
							<form method="POST" action="?/cancelOffer" use:enhance>
								<input type="hidden" name="offer_id" value={offer.id} />
								<button type="submit" class="cancel-offer-btn">Cancel invite</button>
							</form>
						</div>
					{/if}

					{#if slot.status === 'open'}
						<div class="applicants-col">
							{#if pending.length === 0 && decided.length === 0}
								<p class="no-applicants">No applications yet.</p>
							{/if}
							{#each pending as app (app.id)}
								<div class="applicant-row">
									<a href="/profile/{app.artist?.id}" class="applicant-person">
										<span class="avatar">
											{#if app.artist?.avatar_url}
												<img src={app.artist.avatar_url} alt="" />
											{:else}
												{app.artist?.full_name?.[0]?.toUpperCase() ?? '?'}
											{/if}
										</span>
										<span class="applicant-name">{app.artist?.full_name ?? 'Artist'}</span>
									</a>
									{#if app.message}
										<button type="button" class="applicant-message" onclick={() => app.artist && openDM(app.artist.id)}>
											"{app.message}"
										</button>
									{:else}
										<span class="applicant-message-empty"></span>
									{/if}
									<div class="applicant-actions">
										<form method="POST" action="?/acceptApplication" use:enhance>
											<input type="hidden" name="application_id" value={app.id} />
											<button type="submit" class="accept-icon-btn" aria-label="Accept applicant">
												<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
											</button>
										</form>
										<form method="POST" action="?/rejectApplication" use:enhance>
											<input type="hidden" name="application_id" value={app.id} />
											<button type="submit" class="reject-icon-btn" aria-label="Reject applicant">
												<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
											</button>
										</form>
									</div>
								</div>
							{/each}
							{#each decided as app (app.id)}
								<div class="applicant-row decided">
									<a href="/profile/{app.artist?.id}" class="applicant-person">
										<span class="avatar">
											{#if app.artist?.avatar_url}
												<img src={app.artist.avatar_url} alt="" />
											{:else}
												{app.artist?.full_name?.[0]?.toUpperCase() ?? '?'}
											{/if}
										</span>
										<span class="applicant-name">{app.artist?.full_name ?? 'Artist'}</span>
									</a>
									<span class="decided-badge decided-{app.status}">{app.status}</span>
								</div>
							{/each}

							{#if !offer}
								<div class="invite-wrap">
									<button type="button" class="invite-toggle-btn" onclick={() => openInvite(slot.id)}>
										{invitingSlotId === slot.id ? 'Cancel' : '+ Invite an artist privately'}
									</button>
									{#if invitingSlotId === slot.id}
										<form
											method="POST"
											action="?/sendOffer"
											use:enhance={() => async ({ update }) => { await update(); invitingSlotId = null; }}
											class="invite-form"
										>
											<input type="hidden" name="slot_id" value={slot.id} />
											<input type="hidden" name="artist_id" value={selectedArtist?.id ?? ''} />
											<div class="artist-search">
												<input
													type="text"
													placeholder="Search artists by name…"
													bind:value={artistQuery}
													oninput={onArtistQueryInput}
												/>
												{#if artistResults.length > 0}
													<ul class="artist-results">
														{#each artistResults as a (a.id)}
															<li>
																<button type="button" onclick={() => pickArtist(a)}>{a.full_name ?? 'Artist'}</button>
															</li>
														{/each}
													</ul>
												{/if}
											</div>
											<textarea name="message" placeholder="Optional note to include…" rows="2" bind:value={offerMessage} maxlength="1000"></textarea>
											<button type="submit" class="btn btn-primary" disabled={!selectedArtist}>Send Invitation</button>
										</form>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.manage-page {
		max-width: 760px;
		margin: 0 auto;
		padding: 24px 20px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.back-link {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-decoration: none;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		padding: 24px;
	}

	.event-title { margin: 0 0 4px; font-size: 1.5rem; }
	.event-date { margin: 0 0 8px; color: var(--color-text-muted); font-weight: 600; }
	.event-desc { margin: 0; color: var(--color-text-strong); }

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.card-title { margin: 0; font-size: 1.125rem; }

	.new-btn {
		border: 1.5px solid var(--color-border-strong);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		padding: 6px 14px;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.error-banner {
		background: var(--color-danger-bg);
		color: var(--color-danger);
		border: 1px solid var(--color-danger-border);
		border-radius: var(--radius-md);
		padding: 10px 14px;
		font-size: 0.85rem;
		margin: 0 0 12px;
	}

	.add-slot-form {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.add-slot-form .form-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.add-slot-form label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.empty-hint {
		color: var(--color-text-muted);
		font-size: 0.9rem;
	}

	.slot-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.slot-card {
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.slot-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.slot-time { font-weight: 700; }

	.slot-status {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 3px 9px;
		border-radius: 999px;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.slot-status-open { background: var(--color-primary-bg, #ede9fe); color: var(--color-primary); }
	.slot-status-reserved { background: #fef3c7; color: #92400e; }
	.slot-status-filled { background: #dcfce7; color: #166534; }

	.delete-slot-form { margin-left: auto; }

	.del-slot-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		text-decoration: underline;
	}

	.filled-artist {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: var(--color-text-strong);
		font-weight: 600;
	}

	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-ink);
		color: var(--color-cream);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		overflow: hidden;
		flex-shrink: 0;
	}

	.avatar img { width: 100%; height: 100%; object-fit: cover; }

	.offer-row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: var(--radius-md);
		padding: 10px 12px;
	}

	.offer-label { font-size: 0.8rem; color: #92400e; font-weight: 600; }

	.cancel-offer-btn {
		margin-left: auto;
		background: none;
		border: 1px solid #92400e;
		color: #92400e;
		border-radius: var(--radius-md);
		padding: 4px 10px;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.applicants-col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.no-applicants { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }

	.applicant-row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 8px 0;
		border-top: 1px solid var(--color-border);
	}

	.applicant-row.decided { opacity: 0.6; }

	.applicant-person {
		display: flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
		color: var(--color-text-strong);
	}

	.applicant-name { font-weight: 600; font-size: 0.9375rem; }

	.applicant-message {
		background: none;
		border: none;
		color: var(--color-primary);
		cursor: pointer;
		font-size: 0.85rem;
		text-align: left;
		flex: 1;
		min-width: 120px;
		text-decoration: underline;
	}

	.applicant-message-empty { flex: 1; }

	.applicant-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}

	.accept-icon-btn, .reject-icon-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		cursor: pointer;
	}

	.accept-icon-btn { background: #dcfce7; color: #166534; }
	.reject-icon-btn { background: #fee2e2; color: #991b1b; }

	.decided-badge {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		margin-left: auto;
	}

	.decided-accepted { color: #166534; }
	.decided-rejected { color: #991b1b; }

	.invite-wrap { margin-top: 4px; }

	.invite-toggle-btn {
		background: none;
		border: 1.5px dashed var(--color-border-strong);
		border-radius: var(--radius-md);
		padding: 6px 12px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--color-text-muted);
	}

	.invite-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 10px;
	}

	.artist-search { position: relative; }

	.artist-search input, .invite-form textarea {
		width: 100%;
		padding: 8px 10px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-family: inherit;
	}

	.artist-results {
		position: absolute;
		z-index: 2;
		left: 0;
		right: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		list-style: none;
		margin: 4px 0 0;
		padding: 4px;
		box-shadow: 0 8px 20px rgba(0,0,0,0.1);
	}

	.artist-results button {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 6px 8px;
		border-radius: var(--radius-sm, 6px);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.artist-results button:hover { background: var(--color-bg); }
</style>
