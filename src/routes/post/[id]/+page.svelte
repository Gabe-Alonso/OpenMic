<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import MediaCarousel from '$lib/components/MediaCarousel.svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import TagInput from '$lib/components/TagInput.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const post = $derived(data.post);
	const profile = $derived(
		post.profiles as { id: string; full_name: string | null; avatar_url: string | null; location: string | null } | null
	);
	const sortedMedia = $derived(
		[...(post.post_media ?? [])].sort((a: any, b: any) => a.order_index - b.order_index)
	);
	const carouselItems = $derived.by((): { type: 'youtube' | 'image'; src: string }[] => {
		const items: { type: 'youtube' | 'image'; src: string }[] = [];
		for (const m of sortedMedia) {
			if (m.media_type === 'image') items.push({ type: 'image', src: m.url });
		}
		if (post.youtube_url) {
			const match = post.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
			if (match) items.push({ type: 'youtube', src: `https://www.youtube.com/embed/${match[1]}` });
		}
		return items;
	});
	const hasMedia = $derived(carouselItems.length > 0);

	const postTags = $derived(((post as any).tags ?? []) as string[]);
	const isAuthor = $derived(data.currentUserId === (post as any).author_id);
	const editedAt = $derived((post as any).edited_at as string | null);

	// Edit state
	let editing = $state(false);
	let editBody = $state('');
	let editTags = $state<string[]>([]);
	let saving = $state(false);
	let editError = $state<string | null>(null);

	// Delete state
	let confirmDelete = $state(false);
	let deleting = $state(false);

	async function deletePost() {
		if (deleting) return;
		deleting = true;
		const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
		if (res.ok) {
			goto('/community');
		} else {
			deleting = false;
			confirmDelete = false;
		}
	}

	function startEdit() {
		editBody = post.body ?? '';
		editTags = [...postTags];
		editError = null;
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		editError = null;
	}

	async function saveEdit() {
		if (saving) return;
		saving = true;
		editError = null;
		const res = await fetch(`/api/posts/${post.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ body: editBody || null, tags: editTags })
		});
		if (res.ok) {
			await invalidateAll();
			editing = false;
		} else {
			const json = await res.json();
			editError = json.error ?? 'Failed to save.';
		}
		saving = false;
	}

	// Like state — seed from server once, then updated optimistically client-side
	let likeCount = $state(untrack(() => data.likeCount));
	let userLiked = $state(untrack(() => data.userLiked));
	let liking = $state(false);
	let showLikers = $state(false);
	let copied = $state(false);

	async function toggleLike() {
		if (liking) return;
		liking = true;
		const wasLiked = userLiked;
		userLiked = !wasLiked;
		likeCount += wasLiked ? -1 : 1;

		const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
		if (res.ok) {
			const json = await res.json();
			likeCount = json.count;
			userLiked = json.liked;
		} else {
			// Revert optimistic update
			userLiked = wasLiked;
			likeCount += wasLiked ? 1 : -1;
			if (res.status === 401) goto('/signin');
		}
		liking = false;
	}

	async function share() {
		const url = window.location.href;
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ url });
			} else {
				await navigator.clipboard.writeText(url);
				copied = true;
				setTimeout(() => (copied = false), 2000);
			}
		} catch {
			// user cancelled or clipboard unavailable
		}
	}

	function getInitial(): string {
		const name = profile?.full_name || profile?.id;
		return name?.[0]?.toUpperCase() ?? '?';
	}

	function formatMutuals(mutuals: { id: string; full_name: string | null }[]): string {
		const shown = mutuals.slice(0, 3);
		const names = shown.map((m) => m.full_name ?? 'someone').join(', ');
		const extra = mutuals.length - 3;
		if (extra > 0) return `${names} ... and ${extra} more`;
		return names;
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		if (days < 30) return `${days}d ago`;
		return new Date(dateStr).toLocaleDateString();
	}

	// --- Comments ---
	type CommentData = {
		id: string;
		content: string;
		created_at: string;
		parent_id: string | null;
		author: { id: string; full_name: string | null; avatar_url: string | null } | null;
		likeCount: number;
		userLiked: boolean;
		creatorLiked: boolean;
		replies: CommentData[];
	};

	let showComments = $state(false);
	let comments = $state<CommentData[]>([]);
	let loadingComments = $state(false);
	let commentText = $state('');
	let submittingComment = $state(false);
	let commentCount = $state(untrack(() => data.commentCount));
	let replyingTo = $state<string | null>(null);
	let replyText = $state('');
	let submittingReply = $state(false);

	async function toggleComments() {
		showComments = !showComments;
		if (showComments && comments.length === 0 && commentCount > 0) {
			await fetchComments();
		}
	}

	async function fetchComments() {
		loadingComments = true;
		const res = await fetch(`/api/posts/${post.id}/comments`);
		if (res.ok) comments = await res.json();
		loadingComments = false;
	}

	async function submitComment(e: SubmitEvent) {
		e.preventDefault();
		if (!commentText.trim() || submittingComment) return;
		submittingComment = true;
		const res = await fetch(`/api/posts/${post.id}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: commentText, parent_id: null })
		});
		if (res.ok) {
			const newComment: CommentData = await res.json();
			comments = [...comments, newComment];
			commentText = '';
			commentCount++;
		} else if (res.status === 401) {
			goto('/signin');
		}
		submittingComment = false;
	}

	async function submitReply(parentId: string) {
		if (!replyText.trim() || submittingReply) return;
		submittingReply = true;
		const res = await fetch(`/api/posts/${post.id}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: replyText, parent_id: parentId })
		});
		if (res.ok) {
			const newReply: CommentData = await res.json();
			comments = comments.map((c) =>
				c.id === parentId ? { ...c, replies: [...c.replies, newReply] } : c
			);
			replyText = '';
			replyingTo = null;
			commentCount++;
		} else if (res.status === 401) {
			goto('/signin');
		}
		submittingReply = false;
	}

	async function toggleCommentLike(commentId: string, parentId: string | null) {
		const res = await fetch(`/api/comments/${commentId}/like`, { method: 'POST' });
		if (!res.ok) {
			if (res.status === 401) goto('/signin');
			return;
		}
		const { liked, count } = await res.json();
		const isCreator = data.currentUserId === profile?.id;

		function updateComment(c: CommentData): CommentData {
			if (c.id !== commentId) return c;
			return {
				...c,
				likeCount: count,
				userLiked: liked,
				creatorLiked: isCreator ? liked : c.creatorLiked
			};
		}

		if (parentId) {
			comments = comments.map((c) =>
				c.id === parentId ? { ...c, replies: c.replies.map(updateComment) } : c
			);
		} else {
			comments = [...comments.map(updateComment)].sort((a, b) => b.likeCount - a.likeCount);
		}
	}
</script>

<div class="post-page">
	<div class="post-header">
		<div class="post-header-top">
			<a href="/profile/{profile?.id}" class="author-link">
				<div class="author-avatar">
					{#if profile?.avatar_url}
						<img src={profile.avatar_url} alt={profile.full_name ?? ''} />
					{:else}
						<div class="avatar-initial">{getInitial()}</div>
					{/if}
				</div>
				<div class="author-info">
					<div class="author-name-row">
						<span class="author-name">{profile?.full_name ?? 'Anonymous Artist'}</span>
						<span class="author-stats">
							<strong>{data.authorFollowerCount}</strong> followers
							<span class="stats-dot">·</span>
							<strong>{data.authorFollowingCount}</strong> following
						</span>
					</div>
					{#if profile?.location}
						<span class="author-location">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z" />
								<circle cx="12" cy="10" r="3" />
							</svg>
							{profile.location}
						</span>
					{/if}
				</div>
			</a>
			<span class="post-date">{timeAgo(post.created_at)}</span>
			{#if editedAt}
				<span class="edited-label" title={"Edited " + timeAgo(editedAt)}>edited</span>
			{/if}
		</div>

		{#if data.mutuals.length > 0}
			<div class="post-mutuals">
				<div class="mutual-avatars">
					{#each data.mutuals.slice(0, 3) as m}
						<div class="mutual-avatar" title={m.full_name ?? ''}>
							{#if m.avatar_url}
								<img src={m.avatar_url} alt={m.full_name ?? ''} />
							{:else}
								<div class="mutual-initial">{m.full_name?.[0]?.toUpperCase() ?? '?'}</div>
							{/if}
						</div>
					{/each}
				</div>
				<span class="mutuals-text">Followed by {formatMutuals(data.mutuals)}</span>
			</div>
		{/if}
	</div>

	<div class="post-body" class:no-media={!hasMedia}>
		{#if hasMedia}
			<div class="media-panel">
				<MediaCarousel items={carouselItems} />
			</div>
		{/if}

		<div class="text-panel">
			<div class="text-content">
				{#if editing}
					<div class="edit-form">
						{#if editError}<p class="edit-error">{editError}</p>{/if}
						<RichTextEditor value={editBody} onchange={(html) => (editBody = html)} />
						<TagInput tags={editTags} ontags={(t) => (editTags = t)} placeholder="Add tags…" />
						<div class="edit-form-actions">
							<button class="edit-cancel" type="button" onclick={cancelEdit}>Cancel</button>
							<button class="edit-save" type="button" onclick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
						</div>
					</div>
				{:else}
					{#if post.body}
						<div class="post-content">
							{@html post.body}
						</div>
					{:else if !hasMedia}
						<p class="no-content">No content.</p>
					{/if}
					{#if postTags.length > 0}
						<div class="post-tags">
							{#each postTags as tag}
								<a href="/tags/{tag}" class="tag-pill">#{tag}</a>
							{/each}
						</div>
					{/if}
				{/if}
			</div>

			<div class="post-actions">
				<div class="like-group">
					<button
						class="like-btn"
						class:liked={userLiked}
						onclick={toggleLike}
						disabled={liking}
						aria-label={userLiked ? 'Unlike' : 'Like'}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill={userLiked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
						</svg>
					</button>
					{#if likeCount > 0}
						<button class="like-count-btn" onclick={() => (showLikers = true)}>
							{likeCount}
						</button>
					{:else}
						<span class="like-count-zero">0</span>
					{/if}
				</div>

				<div class="comment-group">
					<button class="comment-btn" class:active={showComments} onclick={toggleComments} aria-label="Comments">
						<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
						</svg>
					</button>
					<span class="comment-count">{commentCount}</span>
				</div>

				{#if isAuthor && !editing}
					<button class="edit-post-btn" onclick={startEdit} title="Edit post">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
						Edit
					</button>
					{#if confirmDelete}
						<span class="delete-confirm-text">Delete this post?</span>
						<button class="delete-confirm-btn" onclick={deletePost} disabled={deleting}>
							{deleting ? 'Deleting…' : 'Yes, delete'}
						</button>
						<button class="delete-cancel-btn" onclick={() => (confirmDelete = false)}>Cancel</button>
					{:else}
						<button class="delete-post-btn" onclick={() => (confirmDelete = true)} title="Delete post">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
							Delete
						</button>
					{/if}
				{/if}

				<button class="share-btn" onclick={share} class:share-copied={copied}>
					{#if copied}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12" />
						</svg>
						Copied!
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
							<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
						</svg>
						Share
					{/if}
				</button>
			</div>
		</div>
	</div>

	{#if showComments}
		<div class="comments-section">
			<!-- Add comment form -->
			<form class="comment-form" onsubmit={submitComment}>
				<textarea
					class="comment-input"
					bind:value={commentText}
					placeholder="Add a comment…"
					rows="2"
					maxlength="1000"
				></textarea>
				<button type="submit" class="comment-submit" disabled={submittingComment || !commentText.trim()}>
					{submittingComment ? 'Posting…' : 'Post'}
				</button>
			</form>

			{#if loadingComments}
				<p class="comments-loading">Loading comments…</p>
			{:else if comments.length === 0}
				<p class="comments-empty">No comments yet. Be the first!</p>
			{:else}
				<div class="comments-list">
					{#each comments as comment (comment.id)}
						<div class="comment">
							<a href="/profile/{comment.author?.id}" class="comment-avatar">
								{#if comment.author?.avatar_url}
									<img src={comment.author.avatar_url} alt={comment.author.full_name ?? ''} />
								{:else}
									<span>{comment.author?.full_name?.[0]?.toUpperCase() ?? '?'}</span>
								{/if}
							</a>
							<div class="comment-body">
								<div class="comment-meta">
									<a href="/profile/{comment.author?.id}" class="comment-author">{comment.author?.full_name ?? 'Anonymous'}</a>
									<span class="comment-time">{timeAgo(comment.created_at)}</span>
								</div>
								<p class="comment-text">{comment.content}</p>
								<div class="comment-actions">
									<button
										class="clike-btn"
										class:cliked={comment.userLiked}
										onclick={() => toggleCommentLike(comment.id, null)}
										aria-label={comment.userLiked ? 'Unlike' : 'Like'}
									>
										<svg width="13" height="13" viewBox="0 0 24 24" fill={comment.userLiked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
											<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
										</svg>
										{#if comment.likeCount > 0}
											<span>{comment.likeCount}</span>
										{/if}
									</button>
									{#if comment.creatorLiked && profile}
										<div class="creator-liked" title="{profile.full_name ?? 'Creator'} liked this">
											{#if profile.avatar_url}
												<img src={profile.avatar_url} alt={profile.full_name ?? ''} />
											{:else}
												<span>{profile.full_name?.[0]?.toUpperCase() ?? '?'}</span>
											{/if}
										</div>
									{/if}
									<button class="reply-btn" onclick={() => { replyingTo = replyingTo === comment.id ? null : comment.id; replyText = ''; }}>
										Reply
									</button>
								</div>

								{#if replyingTo === comment.id}
									<div class="reply-form">
										<textarea
											class="comment-input reply-input"
											bind:value={replyText}
											placeholder="Write a reply…"
											rows="2"
											maxlength="1000"
										></textarea>
										<div class="reply-form-actions">
											<button class="reply-cancel" type="button" onclick={() => { replyingTo = null; replyText = ''; }}>Cancel</button>
											<button class="comment-submit" type="button" disabled={submittingReply || !replyText.trim()} onclick={() => submitReply(comment.id)}>
												{submittingReply ? 'Posting…' : 'Reply'}
											</button>
										</div>
									</div>
								{/if}

								{#if comment.replies.length > 0}
									<div class="replies">
										{#each comment.replies as reply (reply.id)}
											<div class="comment reply">
												<a href="/profile/{reply.author?.id}" class="comment-avatar comment-avatar-sm">
													{#if reply.author?.avatar_url}
														<img src={reply.author.avatar_url} alt={reply.author.full_name ?? ''} />
													{:else}
														<span>{reply.author?.full_name?.[0]?.toUpperCase() ?? '?'}</span>
													{/if}
												</a>
												<div class="comment-body">
													<div class="comment-meta">
														<a href="/profile/{reply.author?.id}" class="comment-author">{reply.author?.full_name ?? 'Anonymous'}</a>
														<span class="comment-time">{timeAgo(reply.created_at)}</span>
													</div>
													<p class="comment-text">{reply.content}</p>
													<div class="comment-actions">
														<button
															class="clike-btn"
															class:cliked={reply.userLiked}
															onclick={() => toggleCommentLike(reply.id, comment.id)}
															aria-label={reply.userLiked ? 'Unlike' : 'Like'}
														>
															<svg width="13" height="13" viewBox="0 0 24 24" fill={reply.userLiked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
																<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
															</svg>
															{#if reply.likeCount > 0}
																<span>{reply.likeCount}</span>
															{/if}
														</button>
														{#if reply.creatorLiked && profile}
															<div class="creator-liked" title="{profile.full_name ?? 'Creator'} liked this">
																{#if profile.avatar_url}
																	<img src={profile.avatar_url} alt={profile.full_name ?? ''} />
																{:else}
																	<span>{profile.full_name?.[0]?.toUpperCase() ?? '?'}</span>
																{/if}
															</div>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Likers modal -->
{#if showLikers}
	<div class="modal-backdrop" onclick={() => (showLikers = false)} role="presentation">
		<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="People who liked this" tabindex="-1">
			<div class="modal-header">
				<h2>Liked by</h2>
				<button class="modal-close" onclick={() => (showLikers = false)} aria-label="Close">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="likers-list">
				{#each data.likers as liker}
					{@const p = liker.profiles as any}
					<a href="/profile/{p?.id}" class="liker-item" onclick={() => (showLikers = false)}>
						<div class="liker-avatar">
							{#if p?.avatar_url}
								<img src={p.avatar_url} alt={p.full_name ?? ''} />
							{:else}
								<div class="liker-initial">{p?.full_name?.[0]?.toUpperCase() ?? '?'}</div>
							{/if}
						</div>
						<span class="liker-name">{p?.full_name ?? 'Anonymous Artist'}</span>
					</a>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.post-page {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* Author header */
	.post-header {
		display: flex;
		flex-direction: column;
		gap: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
	}

	.post-header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
	}

	.author-link {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		color: inherit;
	}

	.author-avatar {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
	}

	.author-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-initial {
		width: 100%;
		height: 100%;
		background: var(--color-primary);
		color: white;
		font-weight: 700;
		font-size: 1.1rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.author-info {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.author-name-row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 8px;
	}

	.author-name {
		font-weight: 600;
		font-size: 0.95rem;
		transition: color 0.15s;
		flex-shrink: 0;
	}

	.author-link:hover .author-name {
		color: var(--color-primary);
	}

	.author-stats {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	.author-stats strong {
		color: var(--color-text);
		font-weight: 600;
	}

	.stats-dot {
		opacity: 0.5;
	}

	.author-location {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.post-date {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	/* Mutuals in post header */
	.post-mutuals {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 20px;
		border-top: 1px solid var(--color-border);
		background: var(--color-bg);
	}

	.mutual-avatars {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.mutual-avatar {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--color-surface);
		flex-shrink: 0;
	}

	.mutual-avatar + .mutual-avatar {
		margin-left: -6px;
	}

	.mutual-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.mutual-initial {
		width: 100%;
		height: 100%;
		background: var(--color-primary);
		color: white;
		font-size: 0.55rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mutuals-text {
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	/* Body: 2/3 media + 1/3 text */
	.post-body {
		display: flex;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		min-height: 480px;
	}

	.media-panel {
		flex: 2;
		min-width: 0;
		background: #000;
	}

	.text-panel {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--color-border);
		overflow: hidden;
	}

	.text-content {
		flex: 1;
		padding: 28px;
		overflow-y: auto;
	}

	/* Text-only: full width */
	.post-body.no-media {
		min-height: unset;
	}

	.post-body.no-media .text-panel {
		border-left: none;
	}

	.post-body.no-media .text-content {
		max-width: 720px;
		margin: 0 auto;
		width: 100%;
		padding: 36px;
	}

	/* Rich text content */
	.post-content :global(p) {
		margin: 0 0 1em;
		font-size: 0.95rem;
		line-height: 1.7;
		color: var(--color-text);
	}

	.post-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.post-content :global(h2) {
		font-size: 1.15rem;
		font-weight: 700;
		margin: 0 0 0.6em;
		letter-spacing: -0.3px;
	}

	.post-content :global(ul),
	.post-content :global(ol) {
		padding-left: 1.4em;
		margin: 0 0 1em;
		font-size: 0.95rem;
		line-height: 1.7;
	}

	.post-content :global(strong) { font-weight: 700; }
	.post-content :global(em) { font-style: italic; }

	.no-content {
		font-size: 0.9rem;
		color: var(--color-text-muted);
		font-style: italic;
	}

	/* Actions bar */
	.post-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 12px 20px;
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.like-group {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-right: 8px;
	}

	.like-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: color 0.15s, background 0.15s, transform 0.1s;
	}

	.like-btn:hover {
		color: #f43f5e;
		background: #fff1f2;
	}

	.like-btn.liked {
		color: #f43f5e;
	}

	.like-btn:active {
		transform: scale(0.88);
	}

	.like-btn:disabled {
		cursor: default;
	}

	.like-count-btn {
		background: none;
		border: none;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 4px 6px;
		border-radius: var(--radius-sm);
		transition: color 0.15s, background 0.15s;
		min-width: 20px;
		text-align: left;
	}

	.like-count-btn:hover {
		color: var(--color-text);
		background: var(--color-bg);
	}

	.like-count-zero {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		padding: 4px 6px;
	}

	.share-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 7px 14px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}

	.share-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.share-btn.share-copied {
		border-color: #16a34a;
		color: #16a34a;
		background: #f0fdf4;
	}

	/* Likers modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.modal {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		width: 100%;
		max-width: 360px;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.modal-header h2 {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.2px;
	}

	.modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.modal-close:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}

	.likers-list {
		overflow-y: auto;
		padding: 8px;
	}

	.liker-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: background 0.15s;
	}

	.liker-item:hover {
		background: var(--color-bg);
	}

	.liker-avatar {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
	}

	.liker-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.liker-initial {
		width: 100%;
		height: 100%;
		background: var(--color-primary);
		color: white;
		font-weight: 700;
		font-size: 0.95rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.liker-name {
		font-size: 0.9rem;
		font-weight: 500;
	}

	/* Comment button in action bar */
	.comment-group {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.comment-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: color 0.15s, background 0.15s;
	}

	.comment-btn:hover,
	.comment-btn.active {
		color: var(--color-primary);
		background: var(--color-primary-light);
	}

	.comment-count {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		padding: 4px 2px;
		min-width: 16px;
	}

	/* Comments section */
	.comments-section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}

	.comment-form {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
	}

	.comment-input {
		flex: 1;
		padding: 9px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--color-text);
		background: var(--color-bg);
		resize: vertical;
		outline: none;
		transition: border-color 0.15s;
		line-height: 1.5;
	}

	.comment-input:focus {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	.comment-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	.comment-submit {
		padding: 9px 18px;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
		flex-shrink: 0;
	}

	.comment-submit:hover:not(:disabled) {
		background: var(--color-primary-dark);
	}

	.comment-submit:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.comments-loading,
	.comments-empty {
		padding: 32px 20px;
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.comments-list {
		display: flex;
		flex-direction: column;
	}

	/* Individual comment */
	.comment {
		display: flex;
		gap: 12px;
		padding: 14px 20px;
		border-bottom: 1px solid var(--color-border);
	}

	.comment:last-child {
		border-bottom: none;
	}

	.comment-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		text-decoration: none;
	}

	.comment-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.comment-avatar span {
		color: white;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.comment-avatar-sm {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
	}

	.comment-avatar-sm span {
		font-size: 0.7rem;
	}

	.comment-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.comment-meta {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.comment-author {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text);
		text-decoration: none;
	}

	.comment-author:hover {
		color: var(--color-primary);
	}

	.comment-time {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.comment-text {
		font-size: 0.875rem;
		line-height: 1.55;
		color: var(--color-text);
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.comment-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 2px;
	}

	/* Comment like button */
	.clike-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		cursor: pointer;
		padding: 3px 6px;
		border-radius: var(--radius-sm);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--color-text-muted);
		transition: color 0.15s, background 0.15s;
	}

	.clike-btn:hover {
		color: #f43f5e;
		background: #fff1f2;
	}

	.clike-btn.cliked {
		color: #f43f5e;
	}

	/* Creator liked indicator */
	.creator-liked {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		overflow: hidden;
		border: 1.5px solid #f43f5e;
		flex-shrink: 0;
		background: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.creator-liked img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.creator-liked span {
		color: white;
		font-size: 0.5rem;
		font-weight: 700;
	}

	/* Reply button */
	.reply-btn {
		background: none;
		border: none;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 3px 6px;
		border-radius: var(--radius-sm);
		transition: color 0.15s, background 0.15s;
	}

	.reply-btn:hover {
		color: var(--color-primary);
		background: var(--color-primary-light);
	}

	/* Reply form */
	.reply-form {
		margin-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.reply-input {
		font-size: 0.82rem;
	}

	.reply-form-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.reply-cancel {
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 6px 14px;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.reply-cancel:hover {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	/* Replies */
	.replies {
		margin-top: 8px;
		margin-left: -48px;
		border-left: 2px solid var(--color-border);
		padding-left: 12px;
	}

	.reply {
		padding: 10px 0 10px 0;
		border-bottom: none;
	}

	.reply:first-child {
		padding-top: 0;
	}

	/* Tags */
	.post-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 14px;
	}

	.tag-pill {
		display: inline-flex;
		align-items: center;
		background: var(--color-primary-light, #f0f0ff);
		color: var(--color-primary);
		border-radius: 999px;
		padding: 3px 12px;
		font-size: 0.78rem;
		font-weight: 600;
		text-decoration: none;
		transition: background 0.15s, color 0.15s;
	}

	.tag-pill:hover {
		background: var(--color-primary);
		color: white;
	}

	/* Edited label */
	.edited-label {
		font-size: 0.72rem;
		color: var(--color-text-muted);
		font-style: italic;
		margin-left: 4px;
	}

	/* Edit button in actions */
	.edit-post-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 7px 14px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.edit-post-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.delete-post-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 7px 14px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.delete-post-btn:hover {
		border-color: #ef4444;
		color: #ef4444;
	}

	.delete-confirm-text {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.delete-confirm-btn {
		background: #ef4444;
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 7px 14px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
	}

	.delete-confirm-btn:hover:not(:disabled) {
		background: #dc2626;
	}

	.delete-confirm-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.delete-cancel-btn {
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 7px 12px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.delete-cancel-btn:hover {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	/* Inline edit form */
	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-bottom: 8px;
	}

	.edit-error {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
		border-radius: var(--radius-sm);
		padding: 8px 12px;
		font-size: 0.82rem;
	}

	.edit-form-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.edit-cancel {
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 7px 16px;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.edit-cancel:hover {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	.edit-save {
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 7px 20px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
	}

	.edit-save:hover:not(:disabled) {
		background: var(--color-primary-dark);
	}

	.edit-save:disabled {
		opacity: 0.6;
		cursor: default;
	}

</style>
