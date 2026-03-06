<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		value?: string;
		onchange?: (html: string) => void;
	}

	let { value = '', onchange }: Props = $props();

	let editorEl: HTMLDivElement;
	let editor: any = null;

	let bold = $state(false);
	let italic = $state(false);
	let h2 = $state(false);
	let bullet = $state(false);
	let ordered = $state(false);

	function sync() {
		if (!editor) return;
		bold = editor.isActive('bold');
		italic = editor.isActive('italic');
		h2 = editor.isActive('heading', { level: 2 });
		bullet = editor.isActive('bulletList');
		ordered = editor.isActive('orderedList');
	}

	onMount(async () => {
		const [{ Editor }, { default: StarterKit }] = await Promise.all([
			import('@tiptap/core'),
			import('@tiptap/starter-kit')
		]);

		editor = new Editor({
			element: editorEl,
			extensions: [StarterKit],
			content: value,
			editorProps: { attributes: { class: 'prose-content' } },
			onUpdate: ({ editor: e }: any) => onchange?.(e.getHTML()),
			onSelectionUpdate: sync,
			onTransaction: sync
		});

		return () => editor?.destroy();
	});
</script>

<div class="editor-wrap">
	<div class="toolbar">
		<button type="button" class:on={bold} onclick={() => editor?.chain().focus().toggleBold().run()} title="Bold">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
		</button>
		<button type="button" class:on={italic} onclick={() => editor?.chain().focus().toggleItalic().run()} title="Italic">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
		</button>
		<button type="button" class:on={h2} onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading">
			<span style="font-size:0.8rem;font-weight:700;letter-spacing:-0.5px;">H2</span>
		</button>
		<button type="button" class:on={bullet} onclick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
		</button>
		<button type="button" class:on={ordered} onclick={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered list">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
		</button>
		<div class="sep"></div>
		<button type="button" onclick={() => editor?.chain().focus().undo().run()} title="Undo">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
		</button>
		<button type="button" onclick={() => editor?.chain().focus().redo().run()} title="Redo">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
		</button>
	</div>
	<div bind:this={editorEl} class="editor-body"></div>
</div>

<style>
	.editor-wrap {
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--color-bg);
		transition: border-color 0.15s;
	}

	.editor-wrap:focus-within {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.toolbar button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 28px;
		border: none;
		background: none;
		border-radius: 6px;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.toolbar button:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}

	.toolbar button.on {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.sep {
		width: 1px;
		height: 18px;
		background: var(--color-border);
		margin: 0 4px;
	}

	.editor-body {
		min-height: 200px;
	}

	/* ProseMirror content styles */
	:global(.prose-content) {
		outline: none;
		padding: 14px 16px;
		font-size: 0.9rem;
		line-height: 1.65;
		color: var(--color-text);
		min-height: 200px;
	}

	:global(.prose-content p) {
		margin: 0 0 10px;
	}

	:global(.prose-content p:last-child) {
		margin-bottom: 0;
	}

	:global(.prose-content h2) {
		font-size: 1.15rem;
		font-weight: 700;
		margin: 16px 0 8px;
		letter-spacing: -0.3px;
	}

	:global(.prose-content ul, .prose-content ol) {
		padding-left: 1.5em;
		margin: 8px 0;
	}

	:global(.prose-content li) {
		margin: 3px 0;
	}

	:global(.prose-content strong) {
		font-weight: 700;
	}

	:global(.prose-content em) {
		font-style: italic;
	}

	:global(.prose-content blockquote) {
		border-left: 3px solid var(--color-primary-light);
		padding-left: 12px;
		color: var(--color-text-muted);
		margin: 10px 0;
	}

	:global(.prose-content code) {
		background: var(--color-bg);
		border-radius: 4px;
		padding: 1px 6px;
		font-size: 0.85em;
		font-family: monospace;
	}

	:global(.prose-content hr) {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 16px 0;
	}

	:global(.prose-content p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		color: var(--color-text-muted);
		opacity: 0.6;
		pointer-events: none;
		float: left;
		height: 0;
	}
</style>
