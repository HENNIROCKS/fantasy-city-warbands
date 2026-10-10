<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		badge,
		back,
		actions
	}: {
		title: string;
		/** A word beside the title, such as the app's stage. It stays whole while the title truncates. */
		badge?: string | null;
		back?: string;
		actions?: Snippet;
	} = $props();
</script>

<header class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-5 py-4">
	<div class="flex min-w-0 items-center gap-3">
		{#if back}
			<a href={back} class="-my-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus-visible:bg-zinc-800 focus-visible:text-white" aria-label="Back">←</a>
		{/if}
		<!-- One step less letter-spacing on a phone, where the full width would cut the app's name short beside its badge. -->
		<h1 class="truncate text-sm font-semibold tracking-wider text-zinc-200 uppercase sm:tracking-widest">{title}</h1>
		{#if badge}
			<span
				class="shrink-0 rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-xs font-semibold tracking-wider text-zinc-400 uppercase"
				>{badge}</span
			>
		{/if}
	</div>
	{@render actions?.()}
</header>
