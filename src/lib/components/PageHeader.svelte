<script lang="ts">
	import HeaderMenu from '$lib/components/HeaderMenu.svelte';

	let {
		title,
		badge,
		back,
		onback,
		menu = true
	}: {
		title: string;
		/** A word beside the title, such as the app's stage. It stays whole while the title truncates. */
		badge?: string | null;
		back?: string;
		/** Runs before the back link is followed, and may take its place, such as by going back in the history. */
		onback?: (event: MouseEvent) => void;
		/** Whether the app's own links stand at the right; a page shown outside the app has none. */
		menu?: boolean;
	} = $props();
</script>

<!-- Tighter on a phone, where the app's name, its badge, the about icon and
     the theme switch only just fit 375 px; from sm on the Card Creator's
     spacing. -->
<header
	class="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-5 py-4 sm:gap-3"
>
	<div class="flex min-w-0 items-center gap-2 sm:gap-3">
		{#if back}
			<!-- Pulled left by the space beside the arrow in its 44 px touch area, so
			     the arrow itself lines up with the content below. -->
			<a href={back} onclick={onback} class="-my-2 -ml-[15px] flex h-11 w-11 shrink-0 items-center justify-center rounded text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus-visible:bg-zinc-800 focus-visible:text-white" aria-label="Back">←</a>
		{/if}
		<h1 class="truncate text-sm font-semibold tracking-normal text-zinc-200 uppercase sm:tracking-widest">{title}</h1>
		{#if badge}
			<span
				class="shrink-0 rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wider text-zinc-400 uppercase sm:px-2 sm:text-xs"
				>{badge}</span
			>
		{/if}
	</div>
	{#if menu}<HeaderMenu />{/if}
</header>
