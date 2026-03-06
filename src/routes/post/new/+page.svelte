<script lang="ts">
	import { goto } from '$app/navigation';
	import { createClient } from '$lib/supabase';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';

	const supabase = createClient();
	const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB per image

	let body = $state('');
	let youtubeUrl = $state('');
	let imageFiles = $state<File[]>([]);
	let imagePreviews = $state<string[]>([]);
	let publishing = $state(false);
	let error = $state<string | null>(null);

	function handleFileSelect(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = ''; // reset so same file can be re-selected

		for (const file of files) {
			if (file.size > MAX_IMAGE_SIZE) {
				error = `"${file.name}" is too large (max 10 MB per image).`;
				return;
			}
		}
		error = null;
		imageFiles = [...imageFiles, ...files];
		imagePreviews = [...imagePreviews, ...files.map((f) => URL.createObjectURL(f))];
	}

	function removeImage(i: number) {
		URL.revokeObjectURL(imagePreviews[i]);
		imageFiles = imageFiles.filter((_, idx) => idx !== i);
		imagePreviews = imagePreviews.filter((_, idx) => idx !== i);
	}

	function parseYoutubeId(url: string): string | null {
		const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
		return m ? m[1] : null;
	}

	async function publish() {
		if (publishing) return;
		if (!body.trim() && imageFiles.length === 0 && !youtubeUrl.trim()) {
			error = 'Add some content before publishing.';
			return;
		}
		if (youtubeUrl.trim() && !parseYoutubeId(youtubeUrl)) {
			error = 'That doesn\'t look like a valid YouTube URL.';
			return;
		}

		error = null;
		publishing = true;

		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) {
				goto('/signin');
				return;
			}

			// Upload images to Supabase Storage
			const media: { url: string; media_type: string }[] = [];
			for (let i = 0; i < imageFiles.length; i++) {
				const file = imageFiles[i];
				const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
				const path = `${user.id}/${Date.now()}-${i}.${ext}`;

				const { error: uploadError } = await supabase.storage
					.from('post-media')
					.upload(path, file);
				if (uploadError) throw new Error(uploadError.message);

				const { data: urlData } = supabase.storage.from('post-media').getPublicUrl(path);
				media.push({ url: urlData.publicUrl, media_type: 'image' });
			}

			// Create the post via API
			const res = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					body: body || null,
					youtube_url: youtubeUrl.trim() || null,
					media
				})
			});

			const result = await res.json();
			if (!res.ok) throw new Error(result.error ?? 'Failed to publish.');

			goto(`/post/${result.id}`);
		} catch (err: any) {
			error = err.message ?? 'Something went wrong.';
			publishing = false;
		}
	}
</script>

<div class="new-post-page">
	<div class="page-header">
		<a href="/profile" class="back-link">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
			Cancel
		</a>
		<h1>New Post</h1>
		<button class="publish-btn" onclick={publish} disabled={publishing}>
			{#if publishing}
				<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"/></svg>
				Publishing…
			{:else}
				Publish
			{/if}
		</button>
	</div>

	{#if error}
		<p class="error-msg">{error}</p>
	{/if}

	<div class="card">
		<label class="section-label">Content</label>
		<RichTextEditor value="" onchange={(html) => (body = html)} />
	</div>

	<div class="card">
		<div class="media-header">
			<label class="section-label">Images</label>
			<label class="add-image-btn">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
				Add images
				<input type="file" accept="image/*" multiple onchange={handleFileSelect} class="sr-only" />
			</label>
		</div>

		{#if imagePreviews.length > 0}
			<div class="image-grid">
				{#each imagePreviews as src, i}
					<div class="image-wrap">
						<img {src} alt="" />
						<button class="remove-btn" type="button" onclick={() => removeImage(i)} aria-label="Remove">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="media-hint">Upload photos to accompany your post. Max 10 MB each.</p>
		{/if}
	</div>

	<div class="card">
		<label class="section-label" for="youtube">YouTube Video (optional)</label>
		<input
			id="youtube"
			type="url"
			placeholder="https://youtube.com/watch?v=..."
			bind:value={youtubeUrl}
			class="url-input"
		/>
		{#if youtubeUrl && parseYoutubeId(youtubeUrl)}
			<p class="yt-ok">
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
				Valid YouTube URL
			</p>
		{/if}
	</div>
</div>

<style>
	.new-post-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		text-decoration: none;
		transition: color 0.15s;
	}

	.back-link:hover {
		color: var(--color-text);
	}

	h1 {
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.3px;
	}

	.publish-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 9px 20px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.publish-btn:hover:not(:disabled) {
		background: var(--color-primary-dark);
	}

	.publish-btn:disabled {
		opacity: 0.65;
		cursor: default;
	}

	.spin {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 24px;
		box-shadow: 0 1px 4px rgba(0,0,0,0.04);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-label {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.error-msg {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
		border-radius: var(--radius-sm);
		padding: 10px 14px;
		font-size: 0.875rem;
	}

	/* Images section */
	.media-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.add-image-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.825rem;
		font-weight: 500;
		color: var(--color-primary);
		cursor: pointer;
		padding: 6px 12px;
		border: 1.5px solid var(--color-primary-light);
		border-radius: var(--radius-sm);
		background: var(--color-primary-light);
		transition: background 0.15s, border-color 0.15s;
	}

	.add-image-btn:hover {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.media-hint {
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.image-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.image-wrap {
		position: relative;
		width: 100px;
		height: 100px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		border: 1px solid var(--color-border);
	}

	.image-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(0, 0, 0, 0.55);
		border: none;
		border-radius: 50%;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		cursor: pointer;
		transition: background 0.15s;
	}

	.remove-btn:hover {
		background: rgba(220, 38, 38, 0.85);
	}

	/* YouTube */
	.url-input {
		padding: 10px 14px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		background: var(--color-bg);
		color: var(--color-text);
		outline: none;
		font-family: inherit;
		transition: border-color 0.15s;
		width: 100%;
		box-sizing: border-box;
	}

	.url-input:focus {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	.yt-ok {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.8rem;
		color: #16a34a;
	}
</style>
