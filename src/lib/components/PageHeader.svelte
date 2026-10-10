<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, back, actions }: { title: string; back?: string; actions?: Snippet } = $props();
</script>

<header class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-5 py-4">
	<div class="flex min-w-0 items-center gap-3">
		{#if back}
			<a href={back} class="-my-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus-visible:bg-zinc-800 focus-visible:text-white" aria-label="Back">←</a>
		{/if}
		<h1 class="truncate text-sm font-semibold tracking-widest text-zinc-200 uppercase">{title}</h1>
	</div>
	{@render actions?.()}
</header>
