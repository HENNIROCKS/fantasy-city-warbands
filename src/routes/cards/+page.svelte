<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { APP_TITLE } from '$lib/app';
	import AftermathSheet from '$lib/components/AftermathSheet.svelte';
	import CardBack, { type BackCampaign, type BackDraft, type BackEquipment, type BackPhoto, type BackRenown } from '$lib/components/CardBack.svelte';
	import RenownSheet, { type LevelPick } from '$lib/components/RenownSheet.svelte';
	import WarbandBack from '$lib/components/WarbandBack.svelte';
	import Deck from '$lib/components/Deck.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import scream from '$lib/assets/sounds/wilhelm-scream.m4a';
	import { adjustCounter, allocate, nextRound, start, stateOf, toggleActivated, toggleMark, toggleWaiting, undoRound, type BattleState } from '$lib/core/battle';
	import { applyAftermath, startAftermath, type AftermathDraft } from '$lib/core/aftermath';
	import { fighterCard, warbandCard, type DeckCard } from '$lib/core/card';
	import { today } from '$lib/core/history';
	import { applyBack, emptyPending, type WarbandBackDraft } from '$lib/core/stash';
	import { loadBattle, loadPhotos, loadSound, loadWarband, savePhoto, saveBattle, saveSound, saveWarband } from '$lib/core/storage.svelte';
	import type { FighterInstance, Warband } from '$lib/core/types';
	import { newExcess, validate } from '$lib/core/validate';
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
	let draft = $state<BackDraft>({ fluff: '', notes: '', xp: 0, tally: {}, wargear: [], stash: [], advances: [], injuries: [] });
	let backCampaign = $state<BackCampaign | null>(null);
	/* What the back of the warband card holds until Done, while `editingId` is the warband's id. */
	let warbandDraft = $state<WarbandBackDraft>({ goldAdded: [], stashOut: [], history: [], removed: [], pending: emptyPending(today()) });
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
		if (warband && instanceId === warband.id) {
			const history = ($state.snapshot(warband.history) ?? []) as WarbandBackDraft['history'];
			warbandDraft = { goldAdded: [], stashOut: [], history, removed: [], pending: emptyPending(today()) };
			editingId = instanceId;
			return;
		}
		const fighter = warband?.fighters.find((f) => f.instanceId === instanceId);
		if (!fighter) return;
		draft = {
			fluff: fighter.fluff ?? '',
			notes: fighter.notes ?? '',
			xp: fighter.xp ?? 0,
			tally: { ...fighter.tally },
			wargear: [...fighter.wargear],
			stash: [...(warband?.stash ?? [])],
			advances: [...(fighter.advances ?? [])],
			injuries: [...(fighter.injuries ?? [])]
		};
		backCampaign = campaignOf(fighter);
		photoDraft = { photo: stored.get(instanceId) ?? null, changed: false };
		editingId = instanceId;
	}

	/* Why a back changes no wargear while a battle goes on, as the Warband Deck says it. */
	const IN_BATTLE = 'Not during a battle – end or cancel it first.';

	/**
	 * What the back may move between the fighter on it and the stash. A piece
	 * from the stash is tried against the same checks as in the builder, on the
	 * warband as the draft leaves it; nothing moves while a battle is on, as in
	 * the Warband Deck.
	 */
	const backEquipment = $derived.by((): BackEquipment | null => {
		if (!warband || !system || !faction || !editingId || editingId === warband.id) return null;
		const instance = warband.fighters.find((f) => f.instanceId === editingId);
		if (!instance) return null;
		const profile = faction.fighters.find((f) => f.id === instance.fighterId);
		const blocked = battle
			? IN_BATTLE
			: !profile
				? "This fighter is not in the app's own rules, so what it may carry cannot be checked."
				: null;
		const nameOf = (id: string) => faction.wargear.find((w) => w.id === id)?.name ?? id;
		const buy = resolve('/build') + `?id=${warband.id}&step=fighters#fighter-${instance.instanceId}`;
		if (blocked || !profile) return { blocked, takesNothing: null, carried: [], stash: [], buy };
		const moved = (wargear: string[], stash: string[]): Warband => ({
			...($state.snapshot(warband) as Warband),
			stash,
			fighters: warband!.fighters.map((f) => (f.instanceId === editingId ? { ...($state.snapshot(f) as FighterInstance), wargear } : ($state.snapshot(f) as FighterInstance)))
		});
		const now = moved(draft.wargear, draft.stash);
		const before = validate(now, system.game, faction);
		return {
			blocked: null,
			takesNothing: profile.wargear.length ? null : (profile.unequipped ?? 'Takes no wargear'),
			carried: draft.wargear.map(nameOf),
			stash: draft.stash.map((id, i) => {
				const after = moved([...draft.wargear, id], draft.stash.filter((_, j) => j !== i));
				return { name: nameOf(id), refused: newExcess(before, after, system.game, faction)?.short ?? null };
			}),
			buy
		};
	});

	/**
	 * What the back may correct of the fighter's campaign, as the game keeps it.
	 * A fighter that never earns experience gains no levels either, as Wyrdcry's
	 * BEAST and THRALL: it gets no section, or only the counters a file brought
	 * it, to take down.
	 */
	function campaignOf(fighter: FighterInstance): BackCampaign | null {
		const game = system?.game;
		if (!game?.campaign) return null;
		const card = cards.find((c) => c.kind === 'fighter' && c.instanceId === fighter.instanceId);
		const keywords = card?.kind === 'fighter' ? card.keywordIds : [];
		const earns = !game.aftermath?.noXp.some((k) => keywords.includes(k));
		const counters = game.campaign.fighter
			.filter((c) => earns || (fighter.tally?.[c.key] ?? 0) > 0)
			.map((c) => ({ ...c, raise: earns }));
		if (!earns && !counters.length) return null;
		return {
			xp: earns,
			addXp: (xp, tally) => {
				const raised = game.aftermath?.gainXp({ ...fighter, xp, tally }, 1);
				return raised ? { xp: raised.xp ?? 0, tally: raised.tally ?? {} } : { xp: xp + 1, tally };
			},
			counters,
			levels: game.advancement?.counter ?? null
		};
	}

	/**
	 * The levels of the fighter on the back, on the fighter as the draft leaves
	 * it: a level spent or a point of renown added there opens or closes one at
	 * once, as in the Warband Deck.
	 */
	const backRenown = $derived.by((): BackRenown | null => {
		const advancement = system?.game.advancement;
		if (!warband || !faction || !advancement || !backCampaign || !editingId || editingId === warband.id) return null;
		const instance = warband.fighters.find((f) => f.instanceId === editingId);
		const profile = instance && faction.fighters.find((f) => f.id === instance.fighterId);
		if (!instance || !profile) return null;
		const values = $state.snapshot(draft);
		const now: FighterInstance = {
			...($state.snapshot(instance) as FighterInstance),
			xp: values.xp,
			tally: values.tally,
			wargear: values.wargear,
			advances: values.advances,
			injuries: values.injuries
		};
		const open = advancement.open(now, profile);
		return {
			label: advancement.label,
			next: open[0] ? { level: open[0], offer: advancement.offer(now, profile, faction, open[0]) } : null,
			waiting: open.length,
			spent: values.advances.map((a, i) => ({ level: a.level, text: advancement.describe(now, profile, faction, i) }))
		};
	});

	/* The names of the injuries the fighter on the back keeps, as the draft leaves them. */
	const backInjuries = $derived.by(() => {
		const injuries = system?.game.injuries;
		if (!injuries || !editingId || editingId === warband?.id) return null;
		return draft.injuries.map((id) => injuries.result(id)?.name ?? id);
	});

	/**
	 * The fighter with the back's text and campaign; a field left blank is left
	 * out, as it is on a fighter never written on, and so are experience and
	 * counters at none where the fighter had none.
	 */
	function written(fighter: FighterInstance, { fluff, notes, xp, tally, wargear, advances, injuries }: BackDraft): FighterInstance {
		const { fluff: _fluff, notes: _notes, xp: _xp, tally: _tally, advances: _advances, injuries: _injuries, ...rest } = fighter;
		const counted = Object.fromEntries(Object.entries(tally).filter(([key, value]) => value !== 0 || fighter.tally?.[key] !== undefined));
		return {
			...rest,
			...(fluff.trim() ? { fluff: fluff.trim() } : {}),
			...(notes.trim() ? { notes: notes.trim() } : {}),
			...(xp || fighter.xp !== undefined ? { xp } : {}),
			...(Object.keys(counted).length || fighter.tally ? { tally: counted } : {}),
			...(advances.length || fighter.advances ? { advances } : {}),
			...(injuries.length || fighter.injuries ? { injuries } : {}),
			wargear
		};
	}

	/* Nothing on the back of the warband card takes the warband further, but
	   Done is held to the same check as the builder. A battle still being
	   entered changes no limit, so it is left out of the check: Done gives it
	   its id, not every keystroke. */
	const backBlocked = $derived.by(() => {
		if (!warband || !system || !faction || editingId !== warband.id) return false;
		const draft = { ...($state.snapshot(warbandDraft) as WarbandBackDraft), pending: emptyPending('') };
		const after = applyBack($state.snapshot(warband) as Warband, system.game, faction, draft);
		return newExcess(validate(warband, system.game, faction), after, system.game, faction) !== null;
	});

	/* A failed write raises the storage warning; the card shows what was written either way. */
	function done() {
		if (!warband || !editingId) return;
		if (editingId === warband.id) {
			if (!system || !faction || backBlocked) return;
			const updated = applyBack($state.snapshot(warband) as Warband, system.game, faction, $state.snapshot(warbandDraft) as WarbandBackDraft);
			editingId = null;
			warband = updated;
			saveWarband(updated);
			return;
		}
		const targetId = editingId;
		const values = $state.snapshot(draft);
		const updated = $state.snapshot(warband) as Warband;
		updated.fighters = updated.fighters.map((f) => (f.instanceId === targetId ? written(f, values) : f));
		/* The stash is the draft's copy from when the card was turned: written only
		   when something moved, so a back that moved nothing leaves it as it is. */
		const before = warband.fighters.find((f) => f.instanceId === targetId)?.wargear ?? [];
		if (values.wargear.join() !== before.join()) updated.stash = values.stash;
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

	/* Dropping a battle loses it for good, so it is asked in a sheet first, with
	   the focus on the answer that keeps playing: ending it where the game has
	   no aftermath, cancelling it where it does. Closed again, the focus goes
	   back to where it came from – for an entry of a menu, the button that
	   opened the menu, since the entry is gone with it. The page behind the
	   sheet is inert meanwhile, which drops the focus it held. */
	let asking = $state<'end' | 'cancel' | null>(null);
	let opener: HTMLElement | null = null;
	/* How many were out when it was asked, as the bar counted them. */
	let askedOut = $state(0);

	function ask(what: 'end' | 'cancel', out: number) {
		const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const menu = active?.closest('[popover]');
		opener = menu ? document.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`) : active;
		askedOut = out;
		asking = what;
	}

	async function keepPlaying() {
		asking = null;
		await tick();
		opener?.focus();
	}

	function dropBattle() {
		asking = null;
		setBattle(null);
	}

	/* The aftermath while it is answered in its sheet over the deck. Who is
	   asked is read once, as the battle starts ending. */
	let aftermath = $state<AftermathDraft | null>(null);

	function endBattle(out: number) {
		const rules = system?.game.aftermath;
		if (!rules || !warband) return ask('end', out);
		const fighters = cards.flatMap((c) => (c.kind === 'fighter' ? [{ instanceId: c.instanceId, name: c.name, keywordIds: c.keywordIds }] : []));
		aftermath = startAftermath(rules, fighters, battle, warband.history ?? []);
	}

	/* The warband first: only once it is stored does the battle go, so a failed
	   write – which raises the storage warning – loses neither. */
	async function applyEnd() {
		if (!warband || !system || !faction || !aftermath) return;
		const updated = applyAftermath($state.snapshot(warband) as Warband, system.game, faction, $state.snapshot(aftermath));
		if (!(await saveWarband(updated))) return;
		warband = updated;
		aftermath = null;
		setBattle(null);
		spending = levels.length > 0;
	}

	/* The levels the fighters have open, in the order the warband keeps them, each
	   lowest first: spent one after the other in a sheet, after a battle or from
	   the Battle menu. */
	const levels = $derived.by(() => {
		const advancement = system?.game.advancement;
		if (!warband || !faction || !advancement) return [];
		return warband.fighters.flatMap((instance) => {
			const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
			if (!fighter) return [];
			return advancement.open(instance, fighter).map((level) => ({ instance, fighter, level }));
		});
	});
	let spending = $state(false);

	/* Written at once, so a phone that goes dark cannot leave a level both spent and open.
	   A failed write raises the storage warning and leaves the level open. */
	async function spendLevel(pick: LevelPick) {
		const next = levels[0];
		if (!warband || !next) return;
		const { level } = next.level;
		const advance = { level, ...pick };
		const updated = $state.snapshot(warband) as Warband;
		updated.fighters = updated.fighters.map((f) =>
			f.instanceId === next.instance.instanceId ? { ...f, advances: [...(f.advances ?? []), advance] } : f
		);
		if (!(await saveWarband(updated))) return;
		warband = updated;
		if (levels.length === 0) spending = false;
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

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		if (asking) keepPlaying();
		else if (spending) spending = false;
	}}
/>

<div class="flex h-dvh flex-col" inert={asking !== null || (spending && levels.length > 0)}>
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
				onend={endBattle}
				oncancelbattle={system.game.aftermath && ((out) => ask('cancel', out))}
				onsound={toggleSound}
				levelsOpen={levels.length}
				levelLabel={system.game.advancement?.label ?? ''}
				onlevels={() => (spending = true)}
				editing={editingId !== null}
				doneDisabled={backBlocked}
				onedit={edit}
				ondone={done}
				oncancel={() => (editingId = null)}
				{photos}
			>
				{#snippet back(card)}
					{#if card.kind === 'warband' && warband}
						<WarbandBack name={card.name} {warband} {faction} game={system.game} blocked={battle ? IN_BATTLE : null} bind:draft={warbandDraft} />
					{:else}
						<CardBack name={card.name} bind:draft bind:photo={photoDraft} campaign={backCampaign} renown={backRenown} injuries={backInjuries} equipment={backEquipment} />
					{/if}
				{/snippet}
			</Deck>
		</main>
	{/if}
</div>

{#if aftermath && warband && faction && system?.game.aftermath}
	<AftermathSheet
		{warband}
		{faction}
		game={system.game}
		rules={system.game.aftermath}
		bind:draft={aftermath}
		onapply={applyEnd}
		onclose={() => (aftermath = null)}
	/>
{/if}

{#if spending && levels.length && system?.game.advancement}
	{@const next = levels[0]}
	<RenownSheet
		name={next.instance.name.trim() || 'Unnamed fighter'}
		label={system.game.advancement.label}
		level={next.level}
		offer={system.game.advancement.offer(next.instance, next.fighter, faction!, next.level)}
		waiting={levels.length - 1}
		onspend={spendLevel}
		onclose={() => (spending = false)}
	/>
{/if}

{#if asking && battle}
	{@const verb = asking === 'end' ? 'End' : 'Cancel'}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="drop-title">
			<h2 id="drop-title">{verb} the battle?</h2>
			<p class="count">Round {battle.round}{#if askedOut > 0}{' '}· {askedOut} out of action{/if}</p>
			<p class="notice">
				Wounds, activations and who is out of action are dropped{asking === 'cancel'
					? ', and nobody earns experience'
					: ''}. The warband itself does not change.
			</p>
			<div class="sheet-actions">
				<button type="button" class="btn" onclick={keepPlaying} use:focusOnMount>Keep playing</button>
				<button type="button" class="btn danger" onclick={dropBattle}>{verb} battle</button>
			</div>
		</div>
	</div>
{/if}
