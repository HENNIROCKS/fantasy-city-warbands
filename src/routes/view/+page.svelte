<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_TITLE } from '$lib/app';
	import Deck from '$lib/components/Deck.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { fighterCard, warbandCard, type DeckCard } from '$lib/core/card';
	import { fromFragment } from '$lib/core/link';
	import type { Known } from '$lib/core/transfer';
	import type { Warband } from '$lib/core/types';
	import { systems, upgraded } from '$lib/systems';

	/*
	 * Someone else's warband, from the link in their code: its cards to look at,
	 * kept nowhere. The link carries the warband in its fragment; scanning
	 * another code while the page is open changes only that.
	 */
	let warband = $state<Warband | null>(null);
	let message = $state<string | null>(null);

	const known: Known = {
		game: (id) => systems[id]?.game.name ?? null,
		faction: (game, id) => systems[game]?.factions.find((f) => f.id === id)?.name ?? null
	};

	/* Counts the reads, so one overtaken by a later code drops its result. */
	let reads = 0;

	async function read() {
		const ticket = ++reads;
		const result = await fromFragment(location.hash, known);
		if (ticket !== reads) return;
		warband = result.ok ? upgraded(result.warband) : null;
		message = result.ok ? null : result.message;
	}
	read();

	const system = $derived(warband ? systems[warband.game] : null);
	const faction = $derived(system?.factions.find((f) => f.id === warband?.factionId) ?? null);
	const title = $derived(warband?.name.trim() || faction?.name || 'Warband');

	const cards = $derived.by<DeckCard[]>(() => {
		const w = warband;
		if (!w || !system || !faction) return [];
		return [warbandCard(w, faction, system.game), ...w.fighters.map((f) => fighterCard(f, faction, system.game, w.picks))];
	});
</script>

<svelte:head>
	<title>{title} · {APP_TITLE}</title>
</svelte:head>

<svelte:window onhashchange={read} />

<div class="flex h-dvh flex-col">
	<PageHeader {title} badge="Read only" back={resolve('/')} />

	{#if message}
		<p class="p-5 text-sm text-zinc-400">{message}</p>
	{:else if warband && system && faction}
		<main class="flex min-h-0 flex-1 flex-col pt-2.5">
			<Deck {cards} columns={system.game.weaponStats.map((s) => s.label)} counter={faction.counter} readonly />
		</main>
	{/if}
</div>
