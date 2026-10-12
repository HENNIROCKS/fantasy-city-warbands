<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { APP_TITLE } from '$lib/app';
	import CardBack, { type BackDraft, type BackPhoto } from '$lib/components/CardBack.svelte';
	import Deck from '$lib/components/Deck.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import scream from '$lib/assets/sounds/wilhelm-scream.m4a';
	import { adjustCounter, allocate, nextRound, start, stateOf, toggleActivated, toggleMark, toggleWaiting, undoRound, type BattleState } from '$lib/core/battle';
	import { fighterCard, warbandCard, type DeckCard } from '$lib/core/card';
	import { loadBattle, loadPhotos, loadSound, loadWarband, savePhoto, saveBattle, saveSound, saveWarband } from '$lib/core/storage.svelte';
	import type { FighterInstance, Warband } from '$lib/core/types';
	import { photoLayout, type PhotoView, type StoredPhoto } from '$lib/photo';
	import { systems } from '$lib/systems';

	/*
	 * A warband and its fighters as a stack of cards, filling the screen under the
	 * header; each card scrolls on its own. What the rules decide about a fighter
	 * changes in the builder; here the battle does, and what is written on the
	 * back of a fighter's card.
	 */
	const id = $derived(page.url.searchParams.get('id'));
	let warband = $state<Warband | null>(null);
	/* The battle lives on this device, beside the warband rather than in it. */
	let battle = $state<BattleState | null>(null);
	/* The id whose warband and battle have been read, so neither shows as missing before. */
	let loadedId = $state<string | null>(null);
	/* The fighter whose card is turned over, and what its back holds until Done.
	   The draft outlasts the edit by half a turn, while the back is still in view. */
	let editingId = $state<string | null>(null);
	let draft = $state<BackDraft>({ fluff: '', notes: '' });
	/* The photo apart from the draft: the warband is written as a whole and has
	   to stay free of the bytes. */
	let photoDraft = $state<BackPhoto>({ photo: null, changed: false });
	/* The warband's photos as stored, and what the cards draw them from. Each
	   object URL is handed back once its photo is replaced or the page left. */
	let stored = new Map<string, StoredPhoto>();
	let photos = $state(new Map<string, PhotoView>());

	function showPhoto(instanceId: string, photo: StoredPhoto | null) {
		const next = new Map(photos);
		const old = next.get(instanceId);
		if (old) URL.revokeObjectURL(old.url);
		next.delete(instanceId);
		stored.delete(instanceId);
		if (photo) {
			const url = URL.createObjectURL(new Blob([photo.bytes], { type: photo.type }));
			next.set(instanceId, { url, ...photoLayout(photo.width, photo.height, photo.crop) });
			stored.set(instanceId, photo);
		}
		photos = next;
	}

	function dropPhotos() {
		for (const view of photos.values()) URL.revokeObjectURL(view.url);
		stored = new Map();
		photos = new Map();
	}

	$effect.pre(() => {
		const current = id;
		warband = null;
		battle = null;
		loadedId = null;
		editingId = null;
		untrack(dropPhotos);
		if (!current) return;
		/* A read for an id left meanwhile comes back to nothing. */
		let left = false;
		Promise.all([loadWarband(current), loadBattle(current)]).then(async ([w, b]) => {
			if (left) return;
			warband = w;
			battle = b;
			loadedId = current;
			if (!w) return;
			const found = await loadPhotos(current, w.fighters.map((f) => f.instanceId));
			if (left) return;
			for (const [instanceId, photo] of found) showPhoto(instanceId, photo);
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
	/** Where the builder names the warband, or the fighter in its editor. */
	function nameField(card: DeckCard): string {
		const at = resolve('/build') + `?id=${warband?.id}`;
		return card.kind === 'warband' ? `${at}&step=finish#warband-name` : `${at}&step=fighters#fighter-name-${card.instanceId}`;
	}

	/* The marks the next round clears. */
	const roundMarks = $derived((system?.game.battle?.marks ?? []).filter((m) => m.lasts === 'round').map((m) => m.key));

	const title = $derived(warband?.name.trim() || faction?.name || 'Cards');

	function edit(instanceId: string) {
		const fighter = warband?.fighters.find((f) => f.instanceId === instanceId);
		if (!fighter) return;
		draft = { fluff: fighter.fluff ?? '', notes: fighter.notes ?? '' };
		photoDraft = { photo: stored.get(instanceId) ?? null, changed: false };
		editingId = instanceId;
	}

	/** The fighter with the back's text; a field left blank is left out, as it is on a fighter never written on. */
	function written(fighter: FighterInstance, { fluff, notes }: BackDraft): FighterInstance {
		const { fluff: _fluff, notes: _notes, ...rest } = fighter;
		return { ...rest, ...(fluff.trim() ? { fluff: fluff.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) };
	}

	/* A failed write raises the storage warning; the card shows what was written either way. */
	function done() {
		if (!warband || !editingId) return;
		const targetId = editingId;
		const values = $state.snapshot(draft);
		const updated = $state.snapshot(warband) as Warband;
		updated.fighters = updated.fighters.map((f) => (f.instanceId === targetId ? written(f, values) : f));
		editingId = null;
		warband = updated;
		saveWarband(updated);
		if (photoDraft.changed) {
			/* IndexedDB trips over the reactivity proxy, so the photo goes in as a plain object. */
			const photo = photoDraft.photo
				? { ...photoDraft.photo, bytes: photoDraft.photo.bytes.slice(0), crop: { ...photoDraft.photo.crop } }
				: null;
			showPhoto(targetId, photo);
			savePhoto(updated.id, targetId, photo);
		}
	}

	$effect(() => () => untrack(dropPhotos));

	let sound = $state(true);
	loadSound().then((on) => (sound = on));
	let audio: HTMLAudioElement | undefined;

	/* Written on every tap: at the table the screen goes dark long before anyone
	   thinks about saving. A failed write raises the storage warning. */
	function setBattle(next: BattleState | null) {
		if (!id) return;
		battle = next;
		/* IndexedDB trips over the reactivity proxy: a plain copy goes in. */
		saveBattle(id, next ? $state.snapshot(next) : null);
	}

	function wound(instanceId: string, delta: number, health: number) {
		const wasOut = stateOf(battle, instanceId).out;
		setBattle(allocate(battle, instanceId, delta, health));
		/* Played within the tap itself, which is what lets iOS sound it. */
		if (sound && !wasOut && stateOf(battle, instanceId).out) {
			audio ??= new Audio(scream);
			audio.currentTime = 0;
			audio.play().catch(() => {});
		}
	}

	/* Ending drops the battle for good, so it is asked in a sheet first, with
	   the focus on the answer that keeps playing. Closed again, the focus goes
	   back to where it came from – for an entry of a menu, the button that
	   opened the menu, since the entry is gone with it. The page behind the
	   sheet is inert meanwhile, which drops the focus it held. */
	let ending = $state(false);
	let opener: HTMLElement | null = null;
	/* How many were out when it was asked, as the bar counted them. */
	let endingOut = $state(0);

	function askEnd(out: number) {
		const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const menu = active?.closest('[popover]');
		opener = menu ? document.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`) : active;
		endingOut = out;
		ending = true;
	}

	async function keepPlaying() {
		ending = false;
		await tick();
		opener?.focus();
	}

	function endBattle() {
		ending = false;
		setBattle(null);
	}

	function focusOnMount(node: HTMLElement) {
		node.focus();
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

<svelte:window onkeydown={(event) => ending && event.key === 'Escape' && keepPlaying()} />

<div class="flex h-dvh flex-col" inert={ending}>
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
				edit={nameField}
				{battle}
				rules={system.game.battle}
				counter={faction.counter}
				{sound}
				onwound={wound}
				onactivated={(instanceId) => setBattle(toggleActivated(battle, instanceId))}
				onwaiting={(instanceId) => setBattle(toggleWaiting(battle, instanceId))}
				onmark={(instanceId, key) => setBattle(toggleMark(battle, instanceId, key))}
				oncount={(delta) => setBattle(adjustCounter(battle, delta))}
				onstart={() => setBattle(start())}
				onnext={() => battle && setBattle(nextRound(battle, roundMarks))}
				onundo={() => battle && setBattle(undoRound(battle))}
				onend={askEnd}
				onsound={toggleSound}
				editing={editingId !== null}
				onedit={edit}
				ondone={done}
				oncancel={() => (editingId = null)}
				{photos}
			>
				{#snippet back(card)}
					<CardBack name={card.name} bind:draft bind:photo={photoDraft} />
				{/snippet}
			</Deck>
		</main>
	{/if}
</div>

{#if ending && battle}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="end-title">
			<h2 id="end-title">End the battle?</h2>
			<p class="count">Round {battle.round}{#if endingOut > 0}{' '}· {endingOut} out of action{/if}</p>
			<p class="notice">Wounds, activations and who is out of action are dropped. The warband itself does not change.</p>
			<div class="sheet-actions">
				<button type="button" class="btn" onclick={keepPlaying} use:focusOnMount>Keep playing</button>
				<button type="button" class="btn danger" onclick={endBattle}>End battle</button>
			</div>
		</div>
	</div>
{/if}
