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
	<div class="toolbar" role="toolbar" aria-label="Formatting">
		<button type="button" class:on={bold} onclick={() => editor?.chain().focus().toggleBold().run()} aria-label="Bold" aria-pressed={bold} style="font-weight:800;">B</button>
		<button type="button" class:on={italic} onclick={() => editor?.chain().focus().toggleItalic().run()} aria-label="Italic" aria-pressed={italic} style="font-style:italic;font-weight:600;">I</button>
		<button type="button" class:on={h2} onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading" aria-pressed={h2} style="font-weight:700;">H2</button>
		<button type="button" class:on={bullet} onclick={() => editor?.chain().focus().toggleBulletList().run()} aria-label="Bullet list" aria-pressed={bullet} class="wide">List</button>
		<button type="button" class:on={ordered} onclick={() => editor?.chain().focus().toggleOrderedList().run()} aria-label="Numbered list" aria-pressed={ordered} class="wide">1. List</button>
		<div class="sep"></div>
		<button type="button" onclick={() => editor?.chain().focus().undo().run()} aria-label="Undo" class="wide">Undo</button>
		<button type="button" onclick={() => editor?.chain().focus().redo().run()} aria-label="Redo" class="wide">Redo</button>
	</div>
	<div bind:this={editorEl} class="editor-body"></div>
</div>

<style>
	.editor-wrap {
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-input);
		overflow: hidden;
		background: var(--color-surface-tint);
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.editor-wrap:focus-within {
		border-color: var(--color-primary);
		background: var(--color-surface);
		box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.35);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		flex-wrap: wrap;
	}

	.toolbar button {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		height: 44px;
		padding: 0 12px;
		border: none;
		background: none;
		border-radius: var(--radius-md);
		color: var(--color-text-strong);
		font-family: inherit;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.12s, color 0.12s;
	}

	.toolbar button.wide {
		font-weight: 600;
	}

	.toolbar button:hover {
		background: var(--color-primary-light);
		color: var(--color-primary-deep);
	}

	.toolbar button.on {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.sep {
		width: 1px;
		height: 24px;
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
