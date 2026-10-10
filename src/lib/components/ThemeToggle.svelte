<script lang="ts">
	import { theme } from '$lib/theme.svelte';

	const label = $derived(theme.dark ? 'Light mode' : 'Dark mode');
</script>

<button type="button" onclick={() => theme.toggle()} class="icon-button" aria-label={label} title={label}>
	{#if theme.dark}
		<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
			<circle cx="8" cy="8" r="2.8" />
			<line x1="8" y1="1" x2="8" y2="2.8" />
			<line x1="8" y1="13.2" x2="8" y2="15" />
			<line x1="1" y1="8" x2="2.8" y2="8" />
			<line x1="13.2" y1="8" x2="15" y2="8" />
			<line x1="3.1" y1="3.1" x2="4.4" y2="4.4" />
			<line x1="11.6" y1="11.6" x2="12.9" y2="12.9" />
			<line x1="3.1" y1="12.9" x2="4.4" y2="11.6" />
			<line x1="11.6" y1="4.4" x2="12.9" y2="3.1" />
		</svg>
	{:else}
		<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<path d="M13.5 10.5A6 6 0 0 1 5.5 2.5a.5.5 0 0 0-.6-.6A6.5 6.5 0 1 0 14.1 11.1a.5.5 0 0 0-.6-.6z" />
		</svg>
	{/if}
</button>
