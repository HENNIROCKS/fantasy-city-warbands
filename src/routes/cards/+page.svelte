<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { APP_TITLE } from '$lib/app';
	import Deck from '$lib/components/Deck.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import scream from '$lib/assets/sounds/wilhelm-scream.m4a';
	import { allocate, stateOf, type BattleState } from '$lib/core/battle';
	import { fighterCard, warbandCard, type DeckCard } from '$lib/core/card';
	import { loadBattle, loadSound, loadWarband, saveBattle, saveSound } from '$lib/core/storage.svelte';
	import type { Warband } from '$lib/core/types';
	import { systems } from '$lib/systems';

	/*
	 * A warband and its fighters as a stack of cards, filling the screen under the
	 * header; each card scrolls on its own. The fighters change in the builder;
	 * here only the battle does.
	 */
	const id = $derived(page.url.searchParams.get('id'));
	let warband = $state<Warband | null>(null);
	/* The battle is the deck's only state: it lives on this device, beside the
	   warband rather than in it. */
	let battle = $state<BattleState | null>(null);
	/* The id whose warband and battle have been read, so neither shows as missing before. */
	let loadedId = $state<string | null>(null);
	$effect.pre(() => {
		const current = id;
		warband = null;
		battle = null;
		loadedId = null;
		if (!current) return;
		/* A read for an id left meanwhile comes back to nothing. */
		let left = false;
		Promise.all([loadWarband(current), loadBattle(current)]).then(([w, b]) => {
			if (left) return;
			warband = w;
			battle = b;
			loadedId = current;
		});
		return () => {
			left = true;
		};
	});
	const system = $derived(warband ? systems[warband.game] : null);
	const faction = $derived(system?.factions.find((f) => f.id === warband?.factionId) ?? null);
	/* The warband's own card first, then its fighters. */
	const cards = $derived.by<DeckCard[]>(() => {
		const w = warband;
		if (!w || !system || !faction) return [];
		return [warbandCard(w, faction, system.game), ...w.fighters.map((f) => fighterCard(f, faction, system.game, w.picks))];
	});
	const title = $derived(warband?.name.trim() || faction?.name || 'Cards');

	let sound = $state(true);
	loadSound().then((on) => (sound = on));
	let audio: HTMLAudioElement | undefined;

	function wound(instanceId: string, delta: number, health: number) {
		if (!id) return;
		const wasOut = stateOf(battle, instanceId).out;
		battle = allocate(battle, instanceId, delta, health);
		saveBattle(id, battle);
		/* Played within the tap itself, which is what lets iOS sound it. */
		if (sound && !wasOut && stateOf(battle, instanceId).out) {
			audio ??= new Audio(scream);
			audio.currentTime = 0;
			audio.play().catch(() => {});
		}
	}

	function endBattle() {
		if (!id) return;
		battle = null;
		saveBattle(id, null);
	}

	function toggleSound() {
		sound = !sound;
		saveSound(sound);
	}

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

	{#if id && loadedId !== id}
		<!-- Read in a moment; nothing to show until then. -->
	{:else if !warband}
		<p class="p-5 text-sm text-zinc-400">This warband does not exist (any more).</p>
	{:else if !system || !faction}
		<p class="p-5 text-sm text-zinc-400">This warband's faction is unknown.</p>
	{:else if warband.fighters.length === 0}
		<p class="p-5 text-sm text-zinc-400">
			No fighters yet. <a class="underline" href={resolve('/build') + `?id=${warband.id}&step=fighters`}>Recruit some.</a>
		</p>
	{:else}
		<main class="flex min-h-0 flex-1 flex-col pt-2.5">
			<Deck
				{cards}
				columns={system.game.weaponStats.map((s) => s.label)}
				edit={resolve('/build') + `?id=${warband.id}&step=finish#warband-name`}
				{battle}
				{sound}
				onwound={wound}
				onend={endBattle}
				onsound={toggleSound}
			/>
		</main>
	{/if}
</div>
