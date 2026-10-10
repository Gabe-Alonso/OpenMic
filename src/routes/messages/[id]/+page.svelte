<script lang="ts">
	import ThreadView from './ThreadView.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<!--
	SvelteKit reuses this page's component instance across navigations between
	two different conversations (same route, only the `[id]` param changes) —
	`load` re-runs and `data` updates, but nothing here would otherwise reset.
	ThreadView seeds its message list and conversation-scoped realtime
	subscription once at mount, so without this `{#key}`, switching threads
	left the old conversation's messages on screen and its realtime channel
	subscribed forever, never picking up the new thread's live updates.
	Keying on the conversation id forces Svelte to destroy and recreate
	ThreadView — onDestroy unsubscribes the old channel, onMount seeds fresh
	state and subscribes to the new one.
-->
{#key data.conversation.id}
	<ThreadView {data} />
{/key}
