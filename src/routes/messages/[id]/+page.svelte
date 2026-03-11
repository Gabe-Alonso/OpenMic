<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { createBrowserClient } from '@supabase/ssr';
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let messages = $state(data.messages as any[]);
	let convo = $state(data.conversation);
	let text = $state('');
	let sending = $state(false);
	let sendError = $state<string | null>(null);
	let acceptError = $state<string | null>(null);
	let otherTyping = $state(false);
	let typingTimer: ReturnType<typeof setTimeout> | null = null;
	let myTypingTimer: ReturnType<typeof setTimeout> | null = null;
	let fileInput: HTMLInputElement;
	let messagesEnd: HTMLDivElement;
	let channel: any;

	const isGroup = $derived((convo as any).is_group === true);

	// Build a map of participant id -> profile for group chats
	const participantMap = $derived(
		Object.fromEntries(
			((data as any).participants as any[]).map((p: any) => [p.id, p])
		)
	);

	const YOUTUBE_RE = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i;

	function getYouTubeEmbedUrl(url: string): string {
		const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
		return match ? `https://www.youtube.com/embed/${match[1]}` : '';
	}

	function formatTime(ts: string): string {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	async function scrollToBottom() {
		await tick();
		messagesEnd?.scrollIntoView({ behavior: 'smooth' });
	}

	function handleNewMessage(payload: any) {
		const msg = payload.new;
		if (messages.some((m) => m.id === msg.id)) return;
		const idx = messages.findIndex((m) => m._optimistic && m.sender_id === msg.sender_id);
		if (idx !== -1) {
			messages[idx] = msg;
		} else {
			messages = [...messages, msg];
		}
		scrollToBottom();
		if (msg.sender_id !== data.userId) {
			fetch(`/api/messages/conversations/${convo.id}/read`, { method: 'POST' });
		}
	}

	function handleMessageUpdate(payload: any) {
		const updated = payload.new;
		messages = messages.map((m) => (m.id === updated.id ? { ...m, ...updated } : m));
	}

	function handleTyping(payload: any) {
		if (payload.payload?.userId === data.userId) return;
		otherTyping = true;
		if (typingTimer) clearTimeout(typingTimer);
		typingTimer = setTimeout(() => { otherTyping = false; }, 3000);
	}

	function onInput() {
		if (!channel) return;
		if (myTypingTimer) clearTimeout(myTypingTimer);
		channel.send({ type: 'broadcast', event: 'typing', payload: { userId: data.userId } });
		myTypingTimer = setTimeout(() => { myTypingTimer = null; }, 2000);
	}

	async function sendText() {
		const trimmed = text.trim();
		if (!trimmed || sending) return;
		const isYT = YOUTUBE_RE.test(trimmed);
		const type = isYT ? 'youtube' : 'text';

		const optimistic = {
			id: crypto.randomUUID(),
			conversation_id: convo.id,
			sender_id: data.userId,
			message_type: type,
			content: isYT ? null : trimmed,
			youtube_url: isYT ? trimmed : null,
			image_url: null,
			created_at: new Date().toISOString(),
			read_at: null,
			_optimistic: true
		};
		messages = [...messages, optimistic];
		text = '';
		scrollToBottom();
		sending = true;

		try {
			const res = await fetch(`/api/messages/conversations/${convo.id}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message_type: type, content: isYT ? null : trimmed, youtube_url: isYT ? trimmed : null })
			});
			if (res.ok) {
				const msg = await res.json();
				const hasReal = messages.some((m) => m.id === msg.id);
				if (!hasReal) {
					messages = messages.map((m) => (m.id === optimistic.id ? msg : m));
				} else {
					messages = messages.filter((m) => m.id !== optimistic.id);
				}
				sendError = null;
			} else {
				messages = messages.filter((m) => m.id !== optimistic.id);
				const errBody = await res.json().catch(() => ({}));
				sendError = `Error ${res.status}: ${errBody?.message ?? errBody?.error ?? 'Failed to send.'}`;
				setTimeout(() => { sendError = null; }, 8000);
			}
		} finally {
			sending = false;
		}
	}

	async function sendImage(file: File) {
		const fd = new FormData();
		fd.append('file', file);
		fd.append('conversation_id', convo.id);

		const optimistic = {
			id: crypto.randomUUID(),
			conversation_id: convo.id,
			sender_id: data.userId,
			message_type: 'image',
			content: null,
			image_url: URL.createObjectURL(file),
			youtube_url: null,
			created_at: new Date().toISOString(),
			read_at: null,
			_optimistic: true
		};
		messages = [...messages, optimistic];
		scrollToBottom();

		const uploadRes = await fetch('/api/messages/upload', { method: 'POST', body: fd });
		if (!uploadRes.ok) { messages = messages.filter((m) => m.id !== optimistic.id); return; }
		const { url } = await uploadRes.json();

		const msgRes = await fetch(`/api/messages/conversations/${convo.id}/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message_type: 'image', image_url: url })
		});
		if (msgRes.ok) {
			const msg = await msgRes.json();
			messages = messages.map((m) => (m.id === optimistic.id ? msg : m));
		}
	}

	async function acceptRequest() {
		acceptError = null;
		const res = await fetch(`/api/messages/conversations/${convo.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'accept' })
		});
		if (!res.ok) {
			acceptError = 'Failed to accept request. Please try again.';
			return;
		}
		await invalidateAll();
		convo = data.conversation;
	}

	const lastSentMsg = $derived(
		[...messages].reverse().find((m) => m.sender_id === data.userId && !m._optimistic) ?? null
	);

	onMount(async () => {
		scrollToBottom();
		await fetch(`/api/messages/conversations/${convo.id}/read`, { method: 'POST' });
		await invalidateAll();

		const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
		channel = supabase
			.channel(`conversation:${convo.id}`)
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convo.id}` }, handleNewMessage)
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convo.id}` }, handleMessageUpdate)
			.on('broadcast', { event: 'typing' }, handleTyping)
			.subscribe();
	});

	onDestroy(() => {
		channel?.unsubscribe();
		if (typingTimer) clearTimeout(typingTimer);
		if (myTypingTimer) clearTimeout(myTypingTimer);
	});

	const isRecipientOfRequest = $derived(
		!isGroup && convo.request_status === 'pending' && convo.request_from !== data.userId
	);
	const isSenderOfRequest = $derived(
		!isGroup && convo.request_status === 'pending' && convo.request_from === data.userId
	);
	const inputDisabled = $derived(isRecipientOfRequest);
</script>

<div class="thread-page">
	<!-- Header -->
	<div class="thread-header">
		<a href="/messages" class="back-btn" aria-label="Back">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
		</a>
		{#if isGroup}
			<div class="group-header-info">
				<div class="group-header-icon">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
						<circle cx="9" cy="7" r="4"/>
						<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
						<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
					</svg>
				</div>
				<div class="group-header-text">
					<span class="header-name">{(convo as any).group_name ?? 'Group Chat'}</span>
					<span class="group-member-count">{(data as any).participants?.length ?? 0} members</span>
				</div>
			</div>
		{:else}
			<a href="/profile/{data.otherProfile.id}" class="other-profile">
				{#if data.otherProfile.avatar_url}
					<img src={data.otherProfile.avatar_url} alt={data.otherProfile.full_name ?? 'User'} class="header-avatar" />
				{:else}
					<div class="header-avatar avatar-placeholder">{(data.otherProfile.full_name ?? '?')[0].toUpperCase()}</div>
				{/if}
				<span class="header-name">{data.otherProfile.full_name ?? 'Unknown'}</span>
			</a>
		{/if}
	</div>

	<!-- Message request banners (DM only) -->
	{#if isRecipientOfRequest}
		<div class="request-banner">
			<span><strong>{data.otherProfile.full_name ?? 'Someone'}</strong> wants to message you.</span>
			<button class="accept-btn" onclick={acceptRequest}>Accept</button>
		</div>
		{#if acceptError}
			<div class="send-error">{acceptError}</div>
		{/if}
	{/if}
	{#if isSenderOfRequest}
		<div class="request-banner muted">
			Waiting for <strong>{data.otherProfile.full_name ?? 'them'}</strong> to accept your message request.
		</div>
	{/if}

	<!-- Messages -->
	<div class="messages-wrap">
		{#each messages as msg, i (msg.id)}
			{@const isMine = msg.sender_id === data.userId}
			{@const isLast = msg === lastSentMsg}
			{@const senderProfile = isGroup && !isMine ? participantMap[msg.sender_id] : null}
			{@const prevMsg = i > 0 ? messages[i - 1] : null}
			{@const showSenderLabel = isGroup && !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id)}
			<div class="msg-row" class:mine={isMine}>
				{#if !isMine}
					{#if senderProfile?.avatar_url}
						<img src={senderProfile.avatar_url} alt={senderProfile.full_name ?? 'User'} class="msg-avatar" />
					{:else if !isGroup && data.otherProfile?.avatar_url}
						<img src={data.otherProfile.avatar_url} alt="" class="msg-avatar" />
					{:else}
						<div class="msg-avatar avatar-placeholder">
							{((senderProfile?.full_name ?? data.otherProfile?.full_name ?? '?')[0]).toUpperCase()}
						</div>
					{/if}
				{/if}

				<div class="bubble-col" class:mine={isMine}>
					{#if showSenderLabel}
						<span class="sender-label">{senderProfile?.full_name ?? 'Unknown'}</span>
					{/if}
					<div class="bubble" class:mine={isMine}>
						{#if msg.message_type === 'image'}
							<img src={msg.image_url} alt="Sent image" class="msg-img" />
						{:else if msg.message_type === 'youtube'}
							<div class="yt-wrap">
								<iframe
									src={getYouTubeEmbedUrl(msg.youtube_url)}
									title="YouTube video"
									allowfullscreen
									frameborder="0"
								></iframe>
							</div>
						{:else}
							<span>{msg.content}</span>
						{/if}
					</div>
					<div class="meta" class:mine={isMine}>
						<span class="ts">{formatTime(msg.created_at)}</span>
						{#if isMine && isLast && !isGroup && msg.read_at}
							<span class="read-receipt">Read</span>
						{/if}
					</div>
				</div>
			</div>
		{/each}

		{#if otherTyping}
			<div class="msg-row">
				{#if !isGroup && data.otherProfile?.avatar_url}
					<img src={data.otherProfile.avatar_url} alt="" class="msg-avatar" />
				{:else}
					<div class="msg-avatar avatar-placeholder">…</div>
				{/if}
				<div class="bubble typing-bubble">
					<span class="dot"></span>
					<span class="dot"></span>
					<span class="dot"></span>
				</div>
			</div>
		{/if}

		<div bind:this={messagesEnd}></div>
	</div>

	{#if sendError}
		<div class="send-error">{sendError}</div>
	{/if}

	<!-- Input -->
	<div class="input-area">
		<button
			class="attach-btn"
			aria-label="Send image"
			disabled={inputDisabled}
			onclick={() => fileInput.click()}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
				<polyline points="21 15 16 10 5 21"/>
			</svg>
		</button>
		<input
			type="file"
			accept="image/*"
			class="hidden"
			bind:this={fileInput}
			onchange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) sendImage(f); }}
		/>
		<input
			type="text"
			class="text-input"
			placeholder={inputDisabled ? 'Accept the request to reply' : 'Message…'}
			disabled={inputDisabled}
			bind:value={text}
			oninput={onInput}
			onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
		/>
		<button
			class="send-btn"
			aria-label="Send"
			disabled={!text.trim() || sending || inputDisabled}
			onclick={sendText}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
			</svg>
		</button>
	</div>
</div>

<style>
	.thread-page {
		max-width: 680px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		height: calc(100vh - 100px);
	}

	/* Header */
	.thread-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		color: var(--color-text-muted);
		transition: background 0.12s;
	}

	.back-btn:hover {
		background: var(--color-bg);
	}

	.other-profile {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-text);
	}

	.header-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
	}

	.header-name {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.group-header-info {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.group-header-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.group-header-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.group-member-count {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-primary);
		color: white;
		font-weight: 700;
		font-size: 0.75rem;
	}

	/* Request banners */
	.request-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		background: var(--color-primary-light);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		margin: 12px 0;
		flex-shrink: 0;
	}

	.request-banner.muted {
		background: var(--color-bg);
		border-color: var(--color-border);
		color: var(--color-text-muted);
	}

	.accept-btn {
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 6px 14px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s;
		white-space: nowrap;
	}

	.accept-btn:hover {
		background: var(--color-primary-dark);
	}

	/* Messages */
	.messages-wrap {
		flex: 1;
		overflow-y: auto;
		padding: 16px 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.msg-row {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}

	.msg-row.mine {
		flex-direction: row-reverse;
	}

	.msg-avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
		align-self: flex-end;
	}

	.bubble-col {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-width: 70%;
	}

	.bubble-col.mine {
		align-items: flex-end;
	}

	.sender-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-text-muted);
		padding: 0 4px;
	}

	.bubble {
		background: #e5e7eb;
		color: var(--color-text);
		padding: 10px 14px;
		border-radius: 18px 18px 18px 4px;
		font-size: 0.9rem;
		line-height: 1.45;
		word-break: break-word;
	}

	.bubble.mine {
		background: var(--color-primary);
		color: white;
		border-radius: 18px 18px 4px 18px;
	}

	.msg-img {
		max-width: 260px;
		max-height: 280px;
		border-radius: 10px;
		object-fit: cover;
		display: block;
	}

	.yt-wrap {
		width: 280px;
	}

	.yt-wrap iframe {
		width: 100%;
		aspect-ratio: 16/9;
		border-radius: 10px;
		border: none;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 4px;
	}

	.meta.mine {
		flex-direction: row-reverse;
	}

	.ts {
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.read-receipt {
		font-size: 0.7rem;
		color: var(--color-primary);
		font-weight: 600;
	}

	/* Typing indicator */
	.typing-bubble {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 12px 16px;
		min-width: 54px;
	}

	.dot {
		width: 7px;
		height: 7px;
		background: #9ca3af;
		border-radius: 50%;
		animation: bounce 1.2s infinite;
	}

	.dot:nth-child(2) { animation-delay: 0.2s; }
	.dot:nth-child(3) { animation-delay: 0.4s; }

	@keyframes bounce {
		0%, 60%, 100% { transform: translateY(0); }
		30% { transform: translateY(-6px); }
	}

	/* Input area */
	.input-area {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 0 4px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.attach-btn,
	.send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: none;
		border: 1.5px solid var(--color-border);
		color: var(--color-text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.12s, border-color 0.12s, color 0.12s;
	}

	.attach-btn:hover:not(:disabled),
	.send-btn:hover:not(:disabled) {
		background: var(--color-primary-light);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.send-btn:not(:disabled) {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.send-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.attach-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.text-input {
		flex: 1;
		padding: 10px 14px;
		border: 1.5px solid var(--color-border);
		border-radius: 999px;
		font-size: 0.9rem;
		background: var(--color-bg);
		color: var(--color-text);
		outline: none;
		transition: border-color 0.12s;
	}

	.text-input:focus {
		border-color: var(--color-primary);
	}

	.text-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.hidden {
		display: none;
	}

	.send-error {
		font-size: 0.78rem;
		color: #dc2626;
		padding: 4px 2px;
		flex-shrink: 0;
	}
</style>
