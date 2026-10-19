<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	/* On the settings and about page the same button closes it. */
	const onInfo = $derived(page.url.pathname === resolve('/info'));

	/*
	 * Reached from within the app, closing goes back to where the page was
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
     up with the page's edge and the title keeps the room. The settings link's area
     is 36 px wide rather than 44 and reaches into the gap before the title, so
     the full app name fits beside both at 375 px; its round face matches the
     switch's track and sits 2 px left of centre, so more room falls before
     the switch. -->
<nav class="-mr-3 flex shrink-0 items-center" aria-label="App">
	{#if onInfo}
		<a href={resolve('/')} onclick={close} class="icon-button -ml-2 w-9" aria-label="Close settings and about" title="Close">
			<span class="icon-button-face -translate-x-0.5">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
					<line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
					<line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
				</svg>
			</span>
		</a>
	{:else}
		<a href={resolve('/info')} class="icon-button -ml-2 w-9" aria-label="Settings and about" title="Settings and about">
			<span class="icon-button-face -translate-x-0.5">
				<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
					<path fill="currentColor" fill-rule="evenodd" d="M13.15 6.74 L15.11 6.85 L15.11 9.15 L13.15 9.26 L12.53 10.75 L13.84 12.22 L12.22 13.84 L10.75 12.53 L9.26 13.15 L9.15 15.11 L6.85 15.11 L6.74 13.15 L5.25 12.53 L3.78 13.84 L2.16 12.22 L3.47 10.75 L2.85 9.26 L0.89 9.15 L0.89 6.85 L2.85 6.74 L3.47 5.25 L2.16 3.78 L3.78 2.16 L5.25 3.47 L6.74 2.85 L6.85 0.89 L9.15 0.89 L9.26 2.85 L10.75 3.47 L12.22 2.16 L13.84 3.78 L12.53 5.25 Z M8 5.8 a2.2 2.2 0 1 0 0 4.4 a2.2 2.2 0 1 0 0 -4.4 Z" />
				</svg>
			</span>
		</a>
	{/if}
	<ThemeToggle />
</nav>
