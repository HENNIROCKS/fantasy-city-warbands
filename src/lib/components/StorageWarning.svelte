<script lang="ts">
	import { storage } from '$lib/core/storage.svelte';
</script>

<!-- Red, not amber: what is built from here on is lost with the page. -->
{#if storage.failing}
	<p class="notice danger" role="alert">
		<strong>This browser is not keeping your warbands.</strong> Export the ones you want to keep, with the
		arrow beside each on the start page, before you leave.
	</p>
{/if}
