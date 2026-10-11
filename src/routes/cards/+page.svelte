<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { APP_TITLE } from '$lib/app';
	import Deck from '$lib/components/Deck.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { fighterCard } from '$lib/core/card';
	import { loadWarband } from '$lib/core/storage';
	import { systems } from '$lib/systems';

	/*
	 * A warband's fighters as a stack of cards, filling the screen under the
	 * header; each card scrolls on its own. Read only: the cards change in the
	 * builder.
	 */
	const id = $derived(page.url.searchParams.get('id'));
	const warband = $derived(id ? loadWarband(id) : null);
	const system = $derived(warband ? systems[warband.game] : null);
	const faction = $derived(system?.factions.find((f) => f.id === warband?.factionId) ?? null);
	const cards = $derived(
		warband && system && faction
			? warband.fighters.map((f) => fighterCard(f, faction, system.game, warband.picks))
			: []
	);
	const title = $derived(warband?.name.trim() || faction?.name || 'Cards');

	/* The deck's own colour stands in for the card green on the root, where the
	   explanation overlay reads it too. Left again, the green. */
	$effect(() => {
		const colour = warband?.colour;
		const root = document.documentElement.style;
		if (colour) root.setProperty('--card-green', colour);
		else root.removeProperty('--card-green');
		return () => root.removeProperty('--card-green');
	});

	/*
	 * Reached from within the app – the warband list or the builder's last step –
	 * back returns to where the cards were opened. Opened directly, it goes to
	 * the start.
	 */
	let cameFromApp = $state(false);
	afterNavigate(({ type }) => (cameFromApp = type !== 'enter'));

	function back(event: MouseEvent) {
		if (!cameFromApp) return;
		event.preventDefault();
		history.back();
	}
</script>

<svelte:head>
	<title>{title} · Cards · {APP_TITLE}</title>
</svelte:head>

<div class="flex h-dvh flex-col">
	<PageHeader {title} back={resolve('/')} onback={back} />

	{#if !warband}
		<p class="p-5 text-sm text-zinc-400">This warband does not exist (any more).</p>
	{:else if !system || !faction}
		<p class="p-5 text-sm text-zinc-400">This warband's faction is unknown.</p>
	{:else if cards.length === 0}
		<p class="p-5 text-sm text-zinc-400">
			No fighters yet. <a class="underline" href={resolve('/build') + `?id=${warband.id}&step=fighters`}>Recruit some.</a>
		</p>
	{:else}
		<main class="flex min-h-0 flex-1 flex-col pt-2.5" style="padding-bottom: env(safe-area-inset-bottom)">
			<Deck {cards} columns={system.game.weaponStats.map((s) => s.label)} />
		</main>
	{/if}
</div>
