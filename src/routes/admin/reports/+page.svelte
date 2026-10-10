<script lang="ts">
	import { untrack } from 'svelte';
	import { stripHtml, timeAgo } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let reports = $state(untrack(() => data.reports));
	let busyId = $state<string | null>(null);
	let confirmRemoveId = $state<string | null>(null);

	const REASON_LABELS: Record<string, string> = {
		spam: 'Spam',
		harassment: 'Harassment',
		inappropriate: 'Inappropriate content',
		other: 'Other'
	};

	async function act(reportId: string, action: 'dismiss' | 'remove_post') {
		if (busyId) return;
		busyId = reportId;
		const res = await fetch(`/api/admin/reports/${reportId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action })
		});
		if (res.ok) {
			reports = reports.filter((r: any) => r.id !== reportId);
		}
		confirmRemoveId = null;
		busyId = null;
	}
</script>

<div class="admin-reports">
	<h1>Reported posts</h1>
	<p class="subtitle">{reports.length} pending {reports.length === 1 ? 'report' : 'reports'}</p>

	{#if reports.length === 0}
		<p class="empty">Nothing waiting for review.</p>
	{:else}
		<div class="report-list">
			{#each reports as report (report.id)}
				{@const post = report.post as any}
				{@const author = post?.profiles}
				{@const reporter = report.reporter as any}
				<div class="report-card">
					<div class="report-meta">
						<span class="reason-pill">{REASON_LABELS[report.reason] ?? report.reason}</span>
						<span class="meta-text">
							Reported by {reporter?.full_name ?? 'Unknown'} · {timeAgo(report.created_at)}
						</span>
					</div>

					{#if report.details}
						<p class="details">"{report.details}"</p>
					{/if}

					<div class="post-preview">
						<span class="post-author">{author?.full_name ?? 'Unknown author'}</span>
						<p class="post-body">{stripHtml(post?.body) || '(no text content)'}</p>
						{#if post}
							<a href="/post/{post.id}" target="_blank" class="view-link">View post →</a>
						{:else}
							<span class="view-link disabled">Post already removed</span>
						{/if}
					</div>

					<div class="actions">
						{#if confirmRemoveId === report.id}
							<span class="confirm-text">Remove this post permanently?</span>
							<button class="btn-danger" disabled={busyId === report.id} onclick={() => act(report.id, 'remove_post')}>
								{busyId === report.id ? 'Removing…' : 'Yes, remove'}
							</button>
							<button class="btn-ghost" onclick={() => (confirmRemoveId = null)}>Cancel</button>
						{:else}
							<button class="btn-ghost" disabled={busyId === report.id} onclick={() => act(report.id, 'dismiss')}>
								Dismiss
							</button>
							<button class="btn-danger" disabled={busyId === report.id} onclick={() => (confirmRemoveId = report.id)}>
								Remove post
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.admin-reports {
		max-width: 760px;
		margin: 0 auto;
		padding: 32px 20px;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.subtitle {
		color: var(--color-text-muted);
		font-size: 0.9rem;
		margin: 4px 0 24px;
	}

	.empty {
		color: var(--color-text-muted);
		font-style: italic;
	}

	.report-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.report-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		background: var(--color-surface);
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.report-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.reason-pill {
		background: var(--color-danger-bg);
		color: var(--color-danger);
		border-radius: var(--radius-pill);
		padding: 3px 12px;
		font-size: 0.78rem;
		font-weight: 700;
	}

	.meta-text {
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.details {
		font-size: 0.875rem;
		color: var(--color-text);
		background: var(--color-bg);
		border-radius: var(--radius-md);
		padding: 8px 12px;
		margin: 0;
	}

	.post-preview {
		border-left: 3px solid var(--color-border-strong);
		padding-left: 12px;
	}

	.post-author {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.post-body {
		font-size: 0.875rem;
		color: var(--color-text-body);
		margin: 4px 0 6px;
		white-space: pre-wrap;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.view-link {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-primary-deep);
		text-decoration: none;
	}

	.view-link.disabled {
		color: var(--color-text-muted);
		font-style: italic;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
		justify-content: flex-end;
		margin-top: 4px;
	}

	.confirm-text {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		margin-right: auto;
	}

	.btn-ghost {
		background: none;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-pill);
		padding: 7px 16px;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.btn-ghost:hover:not(:disabled) {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	.btn-danger {
		background: var(--color-danger);
		color: white;
		border: none;
		border-radius: var(--radius-pill);
		padding: 7px 16px;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.btn-danger:hover:not(:disabled) {
		opacity: 0.88;
	}

	.btn-ghost:disabled,
	.btn-danger:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
