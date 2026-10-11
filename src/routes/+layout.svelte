<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import StorageWarning from '$lib/components/StorageWarning.svelte';
	import UpdateBar from '$lib/components/UpdateBar.svelte';
	import { storage } from '$lib/core/storage.svelte';
	import { theme } from '$lib/theme.svelte';

	let { children } = $props();

	onMount(() => theme.init());

	/* Raised once a visit: a failing browser fails on every write, and a sheet
	   coming back with each tap would stand in the way of the export it asks for. */
	let warned = $state(false);
	const warning = $derived(storage.failing && !warned);
</script>

<div class="min-h-dvh bg-zinc-900 text-white" inert={warning}>
	{@render children()}
</div>

<UpdateBar />

{#if warning}
	<StorageWarning onclose={() => (warned = true)} />
{/if}
