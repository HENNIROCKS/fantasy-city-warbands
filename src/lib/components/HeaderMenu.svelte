<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	/* The about page does not link to itself. */
	const onInfo = $derived(page.url.pathname === resolve('/info'));
</script>

<!-- The icons' touch areas reach into the header's padding, so the visible icon
     lines up with the page's edge and the title keeps the room. -->
<nav class="-mr-3 flex shrink-0 items-center" aria-label="App">
	{#if !onInfo}
		<a href={resolve('/info')} class="icon-button" aria-label="About this app" title="About this app">
			<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
				<circle cx="8" cy="8" r="6.5" />
				<line x1="8" y1="7.2" x2="8" y2="11.5" />
				<circle cx="8" cy="4.8" r="0.4" fill="currentColor" />
			</svg>
		</a>
	{/if}
	<ThemeToggle />
</nav>
