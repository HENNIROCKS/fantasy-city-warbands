<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	/* On the about page the same button closes it. */
	const onInfo = $derived(page.url.pathname === resolve('/info'));

	/*
	 * Reached from within the app, closing goes back to where the about page was
	 * opened, the builder's step included. Opened directly, it goes to the start.
	 */
	let cameFromApp = $state(false);
	afterNavigate(({ type }) => (cameFromApp = type !== 'enter'));

	function close(event: MouseEvent) {
		if (!cameFromApp) return;
		event.preventDefault();
		history.back();
	}
</script>

<!-- The touch areas reach into the header's padding, so the theme switch lines
     up with the page's edge and the title keeps the room. The about link's area
     is 36 px wide rather than 44 and reaches into the gap before the title, so
     the full app name fits beside both at 375 px; its round face matches the
     switch's track and sits 2 px left of centre, so more room falls before
     the switch. -->
<nav class="-mr-3 flex shrink-0 items-center" aria-label="App">
	{#if onInfo}
		<a href={resolve('/')} onclick={close} class="icon-button -ml-2 w-9" aria-label="Close the about page" title="Close">
			<span class="icon-button-face -translate-x-0.5">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
					<line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
					<line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
				</svg>
			</span>
		</a>
	{:else}
		<a href={resolve('/info')} class="icon-button -ml-2 w-9" aria-label="About this app" title="About this app">
			<span class="icon-button-face -translate-x-0.5">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<circle cx="8" cy="3" r="1.9" fill="currentColor" stroke="none" />
					<line x1="8" y1="7.4" x2="8" y2="13.3" />
				</svg>
			</span>
		</a>
	{/if}
	<ThemeToggle />
</nav>
