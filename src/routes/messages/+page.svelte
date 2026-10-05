<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const pendingRequests = $derived(
		(data.conversations as any[]).filter(
			(c) => c.request_status === 'pending' && c.request_from !== data.userId
		)
	);

	const regularConvos = $derived(
		(data.conversations as any[]).filter(
			(c) => !(c.request_status === 'pending' && c.request_from !== data.userId)
		)
	);

	let showRequests = $state(false);
	let accepting = $state<string | null>(null);

	// Compose / new chat picker
	let showNewChat = $state(false);
	let pickerSearch = $state('');
	let selected = $state<string[]>([]);
	let groupName = $state('');
	let creating = $state(false);

	const filteredFollowing = $derived(
		((data as any).following as any[]).filter((p: any) =>
			!pickerSearch || (p.full_name ?? '').toLowerCase().includes(pickerSearch.toLowerCase())
		)
	);

	function toggleSelect(id: string) {
		if (selected.includes(id)) {
			selected = selected.filter((s) => s !== id);
		} else if (selected.length < 9) {
			selected = [...selected, id];
		}
	}

	async function startChat() {
		if (selected.length === 0 || creating) return;
		creating = true;
		try {
			let body: any;
			if (selected.length === 1) {
				body = { other_user_id: selected[0] };
			} else {
				body = { participant_ids: selected, group_name: groupName.trim() || null };
			}
			const res = await fetch('/api/messages/conversations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (res.ok) {
				const { conversationId } = await res.json();
				showNewChat = false;
				selected = [];
				groupName = '';
				pickerSearch = '';
				goto(`/messages/${conversationId}`);
			}
		} finally {
			creating = false;
		}
	}

	function closeNewChat() {
		showNewChat = false;
		selected = [];
		groupName = '';
		pickerSearch = '';
	}

	async function acceptRequest(convoId: string) {
		accepting = convoId;
		await fetch(`/api/messages/conversations/${convoId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'accept' })
		});
		await invalidateAll();
		accepting = null;
	}

	function formatTime(ts: string | null): string {
		if (!ts) return '';
		const d = new Date(ts);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
		if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
		return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	function preview(convo: any): string {
		if (!convo.last_msg_type) return 'No messages yet';
		if (convo.last_msg_type === 'image') return '📷 Image';
		if (convo.last_msg_type === 'youtube') return '▶ Video link';
		return convo.last_msg_content ?? '';
	}
</script>

<div class="messages-page">
	<div class="page-header">
		<div class="header-left">
			<p class="header-eyebrow">Inbox</p>
			<h1>Messages</h1>
		</div>
		<div class="header-actions">
			{#if pendingRequests.length > 0}
				<button class="btn btn-outline requests-btn" onclick={() => (showRequests = !showRequests)}>
					Message Requests
					<span class="requests-count">{pendingRequests.length}</span>
					<svg class="chevron" class:open={showRequests} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="6 9 12 15 18 9"/>
					</svg>
				</button>
			{/if}
			<button class="btn btn-primary new-message-btn" aria-expanded={showNewChat} onclick={() => (showNewChat = !showNewChat)}>
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
				</svg>
				New message
			</button>
		</div>
	</div>

	<!-- New chat picker panel -->
	{#if showNewChat}
		<div class="picker-panel">
			<div class="picker-header">
				<span class="picker-title">New Conversation</span>
				<button class="picker-close" onclick={closeNewChat} aria-label="Close">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
			<div class="picker-search-wrap">
				<svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
				</svg>
				<input
					class="picker-search"
					type="text"
					placeholder="Search people you follow…"
					bind:value={pickerSearch}
				/>
			</div>
			<div class="picker-list">
				{#if filteredFollowing.length === 0}
					<div class="picker-empty">
						{pickerSearch ? 'No results' : 'You are not following anyone yet'}
					</div>
				{:else}
					{#each filteredFollowing as person (person.id)}
						{@const isSelected = selected.includes(person.id)}
						<button
							class="picker-row"
							class:picker-selected={isSelected}
							onclick={() => toggleSelect(person.id)}
						>
							<div class="picker-check" class:checked={isSelected}>
								{#if isSelected}
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12"/>
									</svg>
								{/if}
							</div>
							{#if person.avatar_url}
								<img src={person.avatar_url} alt={person.full_name ?? 'User'} class="picker-avatar" />
							{:else}
								<div class="picker-avatar avatar-placeholder">{(person.full_name ?? '?')[0].toUpperCase()}</div>
							{/if}
							<span class="picker-name">{person.full_name ?? 'Unknown'}</span>
						</button>
					{/each}
				{/if}
			</div>
			{#if selected.length >= 2}
				<div class="picker-group-name">
					<input
						class="group-name-input"
						type="text"
						placeholder="Group name (optional)"
						bind:value={groupName}
						maxlength={60}
					/>
				</div>
			{/if}
			<div class="picker-footer">
				{#if selected.length > 0}
					<span class="selected-count">{selected.length} selected</span>
				{/if}
				<button
					class="start-btn"
					disabled={selected.length === 0 || creating}
					onclick={startChat}
				>
					{creating ? '…' : selected.length === 1 ? 'Open Chat' : 'Create Group'}
				</button>
			</div>
		</div>
	{/if}

	{#if showRequests && pendingRequests.length > 0}
		<div class="requests-panel">
			<p class="requests-label">People who want to message you</p>
			{#each pendingRequests as req}
				<div class="request-item">
					<a href="/messages/{req.id}" class="request-profile">
						{#if req.other_avatar_url}
							<img src={req.other_avatar_url} alt={req.other_full_name ?? 'User'} class="avatar" />
						{:else}
							<div class="avatar avatar-placeholder">{(req.other_full_name ?? '?')[0].toUpperCase()}</div>
						{/if}
						<div class="request-info">
							<span class="request-name">{req.other_full_name ?? 'Unknown'}</span>
							<span class="request-preview">{preview(req)}</span>
						</div>
					</a>
					<button
						class="btn btn-cream accept-btn"
						disabled={accepting === req.id}
						onclick={() => acceptRequest(req.id)}
					>
						{accepting === req.id ? '…' : 'Accept'}
					</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if regularConvos.length === 0 && pendingRequests.length === 0}
		<div class="empty-state">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
				<polyline points="22,6 12,13 2,6"/>
			</svg>
			<p>No conversations yet</p>
			<span>Visit an artist's profile to send them a message.</span>
		</div>
	{:else if regularConvos.length > 0}
		<div class="convo-list">
			{#each regularConvos as convo}
				{@const isUnread = convo.last_msg_sender_id && convo.last_msg_sender_id !== data.userId && !convo.last_msg_read_at}
				<a href="/messages/{convo.id}" class="convo-item">
					<div class="avatar-wrap">
						{#if convo.is_group}
							<div class="avatar group-avatar">
								<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
									<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
									<circle cx="9" cy="7" r="4"/>
									<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
									<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
								</svg>
							</div>
						{:else if convo.other_avatar_url}
							<img src={convo.other_avatar_url} alt={convo.other_full_name ?? 'User'} class="avatar" />
						{:else}
							<div class="avatar avatar-placeholder">
								{(convo.other_full_name ?? '?')[0].toUpperCase()}
							</div>
						{/if}
						{#if isUnread}
							<span class="unread-badge"></span>
						{/if}
					</div>
					<div class="convo-body">
						<div class="convo-top">
							<span class="convo-name" class:bold={isUnread}>
								{convo.is_group ? (convo.group_name ?? 'Group Chat') : (convo.other_full_name ?? 'Unknown')}
							</span>
							<span class="convo-time">{formatTime(convo.last_msg_at)}</span>
						</div>
						<span class="convo-preview" class:bold={isUnread}>
							{#if convo.is_group}
								Group &middot; {convo.member_count ?? ''} members
							{:else}
								{preview(convo)}
							{/if}
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.messages-page {
		max-width: 640px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
	}

	.header-eyebrow {
		margin: 0 0 8px;
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-primary-bright);
	}

	h1 {
		margin: 0;
		font-size: clamp(2.5rem, 6vw, 4rem);
		line-height: 0.98;
		letter-spacing: -0.035em;
	}

	.header-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.new-message-btn {
		height: 52px;
		padding: 0 26px;
	}

	.requests-btn {
		height: 52px;
		padding: 0 22px;
		gap: 10px;
	}

	.requests-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 24px;
		padding: 0 7px;
		background: var(--color-primary);
		color: white;
		border-radius: 999px;
		font-size: 0.8125rem;
		font-weight: 700;
	}

	.chevron {
		transition: transform 0.2s;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	/* Picker panel */
	.picker-panel {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.picker-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.picker-title {
		font-size: 0.875rem;
		font-weight: 700;
	}

	.picker-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.12s;
	}

	.picker-close:hover {
		background: var(--color-bg);
	}

	.picker-search-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.search-icon {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.picker-search {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		font-size: 0.875rem;
		color: var(--color-text);
	}

	.picker-list {
		max-height: 260px;
		overflow-y: auto;
	}

	.picker-empty {
		padding: 20px 16px;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		text-align: center;
	}

	.picker-row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 16px;
		background: none;
		border: none;
		border-top: 1px solid var(--color-border);
		cursor: pointer;
		text-align: left;
		transition: background 0.1s;
	}

	.picker-row:first-child {
		border-top: none;
	}

	.picker-row:hover {
		background: var(--color-bg);
	}

	.picker-row.picker-selected {
		background: var(--color-primary-light);
	}

	.picker-check {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid var(--color-border);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.12s, border-color 0.12s;
	}

	.picker-check.checked {
		background: var(--color-primary-bright);
		border-color: var(--color-primary-bright);
	}

	.picker-avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.picker-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.picker-group-name {
		padding: 10px 16px;
		border-top: 1px solid var(--color-border);
	}

	.group-name-input {
		width: 100%;
		padding: 8px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		background: var(--color-bg);
		color: var(--color-text);
		outline: none;
		transition: border-color 0.12s;
	}

	.group-name-input:focus {
		border-color: var(--color-primary);
	}

	.picker-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		padding: 10px 16px;
		border-top: 1px solid var(--color-border);
	}

	.selected-count {
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.start-btn {
		min-height: 36px;
		padding: 0 18px;
		border-radius: var(--radius-pill);
		background: var(--color-primary);
		color: white;
		border: none;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s;
		min-width: 100px;
	}

	.start-btn:hover:not(:disabled) {
		background: var(--color-primary-dark);
	}

	.start-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* Requests panel */
	.requests-panel {
		background: var(--color-panel);
		border-radius: var(--radius-card-lg);
		padding: 24px;
		overflow: hidden;
	}

	.requests-label {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--color-lilac-bright);
		padding: 0 8px 14px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0;
	}

	.request-item {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.07);
	}

	.request-item + .request-item {
		margin-top: 8px;
	}

	.request-profile {
		display: flex;
		align-items: center;
		gap: 14px;
		flex: 1 1 260px;
		min-width: 0;
		color: white;
	}

	.request-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.request-name {
		font-size: 1rem;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.request-preview {
		font-size: 0.875rem;
		color: var(--color-lilac-soft);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.accept-btn {
		flex-shrink: 0;
		min-height: 44px;
		padding: 0 24px;
	}

	.accept-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	/* Conversation list */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 60px 20px;
		color: var(--color-text-muted);
		text-align: center;
	}

	.empty-state p {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--color-text);
		margin: 0;
	}

	.empty-state span {
		font-size: 0.875rem;
	}

	.convo-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.convo-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border-radius: var(--radius-card);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
		color: var(--color-text);
	}

	.convo-item:hover {
		border-color: var(--color-lilac);
		box-shadow: var(--shadow-card-hover);
		transform: translateY(-2px);
	}

	.avatar-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.avatar {
		width: 46px;
		height: 46px;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-primary-bright);
		color: white;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.group-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		color: var(--color-text-muted);
	}

	.unread-badge {
		position: absolute;
		top: 0;
		right: 0;
		width: 10px;
		height: 10px;
		background: var(--color-primary-bright);
		border-radius: 50%;
		border: 2px solid var(--color-surface);
	}

	.convo-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.convo-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.convo-name {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.convo-time {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.convo-preview {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bold {
		font-weight: 700;
		color: var(--color-text);
	}
</style>
