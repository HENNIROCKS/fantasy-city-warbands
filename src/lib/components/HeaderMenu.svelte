<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	/* On the settings page the same button closes it, always to the start –
	   also when Settings was reached from the docs. */
	const onInfo = $derived(page.url.pathname === resolve('/info'));
</script>

<!-- The touch area reaches 9 px into the header's padding, so the round face
     ends at the page's edge and the title keeps the room. -->
<nav class="-mr-[9px] flex shrink-0 items-center" aria-label="App">
	{#if onInfo}
		<a href={resolve('/')} class="icon-button" aria-label="Close settings" title="Close">
			<span class="icon-button-face">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
					<line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
					<line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
				</svg>
			</span>
		</a>
	{:else}
		<a href={resolve('/info')} class="icon-button" aria-label="Settings, docs and about" title="Settings, docs and about">
			<span class="icon-button-face">
				<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
					<path fill="currentColor" fill-rule="evenodd" d="M13.15 6.74 L15.11 6.85 L15.11 9.15 L13.15 9.26 L12.53 10.75 L13.84 12.22 L12.22 13.84 L10.75 12.53 L9.26 13.15 L9.15 15.11 L6.85 15.11 L6.74 13.15 L5.25 12.53 L3.78 13.84 L2.16 12.22 L3.47 10.75 L2.85 9.26 L0.89 9.15 L0.89 6.85 L2.85 6.74 L3.47 5.25 L2.16 3.78 L3.78 2.16 L5.25 3.47 L6.74 2.85 L6.85 0.89 L9.15 0.89 L9.26 2.85 L10.75 3.47 L12.22 2.16 L13.84 3.78 L12.53 5.25 Z M8 5.8 a2.2 2.2 0 1 0 0 4.4 a2.2 2.2 0 1 0 0 -4.4 Z" />
				</svg>
			</span>
		</a>
	{/if}
</nav>
