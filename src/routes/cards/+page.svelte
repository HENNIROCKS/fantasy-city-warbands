<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import { APP_TITLE } from '$lib/app';
	import AftermathSheet from '$lib/components/AftermathSheet.svelte';
	import RichText from '$lib/components/RichText.svelte';
	import CardBack, {
		type BackCampaign,
		type BackDismissal,
		type BackDraft,
		type BackEquipment,
		type BackLead,
		type BackPhoto,
		type BackRenown
	} from '$lib/components/CardBack.svelte';
	import RenownSheet, { type LevelPick } from '$lib/components/RenownSheet.svelte';
	import WarbandBack from '$lib/components/WarbandBack.svelte';
	import Deck from '$lib/components/Deck.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import scream from '$lib/assets/sounds/wilhelm-scream.m4a';
	import { adjustCounter, allocate, hire, isWavering, nextRound, release, rollFor, settingUp, start, stateOf, toggleActivated, toggleMark, toggleWaiting, undoRound, unuseItem, useItem, type BattleState } from '$lib/core/battle';
	import { applyAftermath, startAftermath, usedInBattle, type AftermathDraft } from '$lib/core/aftermath';
	import { bonusBlocked, freeHireOpen, setOpponent, toggleBonus, underdogOf } from '$lib/core/underdog';
	import { fighterCard, warbandCard, type DeckCard } from '$lib/core/card';
	import { toFragment } from '$lib/core/link';
	import { today } from '$lib/core/history';
	import { deadLeaders, mayLead, takeLead } from '$lib/core/leader';
	import { dismiss } from '$lib/core/manage';
	import { applyBack, emptyPending, type WarbandBackDraft } from '$lib/core/stash';
	import { loadBattle, loadPhotos, loadSound, loadTuckBox, loadWarband, savePhoto, saveBattle, saveWarband } from '$lib/core/storage.svelte';
	import type { Faction, Fighter, FighterInstance, Warband } from '$lib/core/types';
	import { newExcess, purse, validate, warbandCost } from '$lib/core/validate';
	import { newId } from '$lib/core/warband';
	import { photoLayout, type PhotoView, type StoredPhoto } from '$lib/photo';
	import { shareLink } from '$lib/share';
	import { startScreenGone } from '$lib/start-screen';
	import { systems, upgraded } from '$lib/systems';

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
	let draft = $state<BackDraft>({ name: '', fluff: '', notes: '', tally: {}, wargear: [], stash: [], advances: [], injuries: [], away: null, lead: false, recovered: false });
	let backCampaign = $state<BackCampaign | null>(null);
	/* What the back of the warband card holds until Done, while `editingId` is the warband's id. */
	let warbandDraft = $state<WarbandBackDraft>({
		name: '',
		fluff: '',
		notes: '',
		colour: null,
		tally: {},
		goldAdded: [],
		stashOut: [],
		stashIn: [],
		history: [],
		removed: [],
		pending: emptyPending(today()),
		clearSearches: false,
		undisband: false
	});
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

	/* Whether the cards open from their box, read with the warband so it is known before they show. */
	let tuckBox = $state(false);

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
		Promise.all([loadWarband(current), loadBattle(current), loadTuckBox()]).then(async ([w, b, box]) => {
			if (left) return;
			warband = w && upgraded(w);
			battle = b;
			tuckBox = box;
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
	/** A piece's name as the faction lists it, its id where the faction has none. */
	const wargearName = (id: string) => faction?.wargear.find((w) => w.id === id)?.name ?? id;
	/** The background the fighter's rules give it, which its back starts from and does not store unchanged. */
	const givenFluff = (fighter: FighterInstance) => faction?.fighters.find((f) => f.id === fighter.fighterId)?.fluff ?? '';
	/* What the faction may hire, and the faction with them added, so a hired fighter's card finds its profile and weapons. */
	const hiring = $derived(system?.game.hiring ?? null);
	const offered = $derived(hiring && faction ? hiring.hirelings.filter((h) => h.factions.includes(faction.id)) : []);
	const hiringFaction = $derived.by((): Faction | null =>
		faction && offered.length
			? { ...faction, fighters: [...faction.fighters, ...offered.map((h) => h.fighter)], wargear: [...faction.wargear, ...offered.flatMap((h) => h.wargear)] }
			: faction
	);
	/* What each hire of the battle costs, in the order they were hired. */
	const hiredFees = $derived(warband && hiring && battle ? hiring.fees(warband, battle.hired) : []);
	/* The warband as the underdog of the battle being set up or fought, and whether its debt still hires one for nothing. */
	const underdog = $derived(warband && system ? underdogOf(system.game.underdog, warband, battle) : null);
	const owedFree = $derived(!!warband && freeHireOpen(underdog, battle, warband));

	/** What a hired fighter picked when it was hired, such as the Goblin Shaman's role, by name. */
	const pickedName = (fighterId: string, picks: string[] = []) =>
		offered
			.find((h) => h.fighter.id === fighterId)
			?.fighter.choices?.flatMap((c) => c.options).filter((o) => picks.includes(o.id))
			.map((o) => o.name)
			.join(', ') ?? '';

	/* The warband's own card first, then its fighters, then whoever was hired for the battle. */
	const cards = $derived.by<DeckCard[]>(() => {
		const w = warband;
		if (!w || !system || !faction || !hiringFaction) return [];
		const hired = (battle?.hired ?? []).map((h, i): DeckCard => {
			const card = fighterCard(
				{ instanceId: h.instanceId, fighterId: h.fighterId, name: '', wargear: [], picks: h.picks },
				hiringFaction,
				system.game,
				{},
				stateOf(battle, h.instanceId).used,
				/* A hired sword fights for the warband, so what the last exploring left for every fighter is its too. */
				w.next ?? []
			);
			return {
				...card,
				name: card.subtitle,
				unnamed: false,
				subtitle: 'Hired for this battle',
				campaign: [{ key: 'fee', label: 'Fee', value: String(hiredFees[i] ?? 0) }],
				hired: true
			};
		});
		/* The hired ones under their own heading on the warband's card, leading to their cards as the rest do. */
		const own = warbandCard(w, faction, system.game);
		/* Under the name its fee, so each entry has a line beneath like the rest. */
		const listed = (battle?.hired ?? []).map((h, i) => ({
			instanceId: h.instanceId,
			name: hired[i].name,
			type: `${hiredFees[i] ?? 0} ${system.game.currency}`,
			leader: false
		}));
		const roster = listed.length ? [...own.roster, { title: hiring?.label ?? null, entries: listed }] : own.roster;
		/* The underdog's bonuses stand on the warband's card while the battle lasts, as reminders for the table. */
		const reminders = [
			...(underdog
				? [
						{ label: 'Underdog', text: `${underdog.behind} behind – +${underdog.roll} on every ${(system.game.aftermath?.roll.label ?? 'roll').toLowerCase()} in the aftermath.` },
						...underdog.picked.map((b) => ({ label: `(Underdog) ${b.name}`, text: b.text }))
					]
				: []),
			/* What the last exploring left for this battle stands there too; a help for the next exploration is asked in the aftermath instead. */
			...(w.next ?? []).filter((n) => !n.explore).map((n) => ({ label: `(Next battle) ${n.source}`, text: n.text }))
		];
		return [
			{ ...own, roster, reminders },
			...w.fighters.map((f) => {
				const state = stateOf(battle, f.instanceId);
				return fighterCard(f, faction, system.game, w.picks, state.used, w.next, state.rolled);
			}),
			...hired
		];
	});
	/** Where the builder names the warband, or the fighter in its editor. */
	function nameField(card: DeckCard): string {
		const at = resolve('/build') + `?id=${warband?.id}`;
		return card.kind === 'warband' ? `${at}&step=finish#warband-name` : `${at}&step=fighters#fighter-name-${card.instanceId}`;
	}

	/* The morale phase at the end of the round: whether the warband wavers as it ends. */
	function wavers(): boolean {
		const morale = system?.game.battle?.wavering;
		if (!morale) return false;
		const roster = cards.flatMap((c) => (c.kind === 'fighter' && !c.hired ? [{ instanceId: c.instanceId, weight: c.weight }] : []));
		return isWavering(battle, roster, morale.wavers);
	}

	/* The marks the next round clears. */
	const roundMarks = $derived((system?.game.battle?.marks ?? []).filter((m) => m.lasts === 'round').map((m) => m.key));

	const title = $derived(warband?.name.trim() || faction?.name || 'Cards');

	function edit(instanceId: string) {
		if (warband && instanceId === warband.id) {
			const history = ($state.snapshot(warband.history) ?? []) as WarbandBackDraft['history'];
			/* A name that is only the faction's is no name of the warband's, as in the builder. */
			const name = warband.name === faction?.name ? '' : warband.name;
			warbandDraft = {
				name,
				fluff: warband.fluff ?? '',
				notes: warband.notes ?? '',
				colour: warband.colour ?? null,
				tally: { ...warband.tally },
				goldAdded: [],
				stashOut: [],
				stashIn: [],
				history,
				removed: [],
				pending: emptyPending(today()),
				clearSearches: false,
				undisband: false
			};
			editingId = instanceId;
			return;
		}
		const fighter = warband?.fighters.find((f) => f.instanceId === instanceId);
		if (!fighter) return;
		draft = {
			name: fighter.name,
			fluff: fighter.fluff ?? givenFluff(fighter),
			notes: fighter.notes ?? '',
			tally: { ...fighter.tally },
			wargear: [...fighter.wargear],
			stash: [...(warband?.stash ?? [])],
			advances: [...(fighter.advances ?? [])],
			injuries: [...(fighter.injuries ?? [])],
			away: fighter.away ?? null,
			lead: false,
			recovered: false
		};
		backCampaign = campaignOf(fighter);
		photoDraft = { photo: stored.get(instanceId) ?? null, changed: false };
		editingId = instanceId;
	}

	/* Why a back changes no wargear while a battle goes on, as the Warband Deck says it. */
	const IN_BATTLE = 'Not during a battle – end or cancel it first.';
	/* Why a disbanded warband fights and changes no more. */
	const DISBANDED = 'Disbanded – it fights no more.';

	/* Why a dead leader still on the roster neither hands its equipment on nor is
	   dismissed: it leaves as another takes the lead, its equipment recovered
	   only on a roll. Null for any other fighter. */
	function deadLeader(instance: FighterInstance): string | null {
		if (!warband || !faction || !deadLeaders(warband, faction).includes(instance)) return null;
		return `Dead – it leaves the roster once a ${system?.game.succession?.keyword.toUpperCase() ?? 'fighter'} takes the lead, its equipment to the stash on a 3+.`;
	}

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
			: warband.disbanded
				? DISBANDED
				: (deadLeader(instance) ??
				(!profile ? "This fighter is not in the app's own rules, so what it may carry cannot be checked." : null));
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
			carried: draft.wargear.map(wargearName),
			stash: draft.stash.map((id, i) => {
				const after = moved([...draft.wargear, id], draft.stash.filter((_, j) => j !== i));
				return { name: wargearName(id), refused: newExcess(before, after, system.game, faction)?.short ?? null };
			}),
			buy
		};
	});

	/**
	 * What the back may correct of the fighter's campaign, as the game keeps it.
	 * A fighter that never rolls for levels gains none, as Wyrdcry's BEAST and
	 * THRALL: it gets no section, or only the counters a file brought it, to take down.
	 */
	function campaignOf(fighter: FighterInstance): BackCampaign | null {
		const game = system?.game;
		if (!game?.campaign) return null;
		const card = cards.find((c) => c.kind === 'fighter' && c.instanceId === fighter.instanceId);
		const keywords = card?.kind === 'fighter' ? card.keywordIds : [];
		const earns = !game.aftermath?.excluded.some((k) => keywords.includes(k));
		const counters = game.campaign.fighter
			.filter((c) => earns || (fighter.tally?.[c.key] ?? 0) > 0)
			.map((c) => ({ ...c, raise: earns }));
		if (!earns && !counters.length) return null;
		return {
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
			tally: values.tally,
			wargear: values.wargear,
			advances: values.advances,
			injuries: values.injuries
		};
		const open = advancement.open(now, profile);
		return {
			label: advancement.label,
			next: open[0] ? { level: open[0], offer: advancement.offer(now, profile, faction, open[0], warband) } : null,
			waiting: open.length,
			spent: values.advances.map((a, i) => ({ level: a.level, text: advancement.describe(now, profile, faction, i, warband!) }))
		};
	});

	/* What the name field on a fighter's back offers while it is blank, as the builder words it. */
	const backPlaceholder = $derived.by(() => {
		const instance = warband?.fighters.find((f) => f.instanceId === editingId);
		const type = instance && faction?.fighters.find((f) => f.id === instance.fighterId);
		return `Name your ${type?.name ?? instance?.fighterId ?? 'fighter'}`;
	});

	/* Whether the fighter on the back may take the lead of a warband that lost its leader, and who leaves the roster when it does.
	   Not while a battle goes on: the dead leader's card and equipment would leave the deck mid-battle. */
	const backLead = $derived.by((): BackLead | null => {
		const game = system?.game;
		const instance = warband?.fighters.find((f) => f.instanceId === editingId);
		if (battle || !warband || !faction || !game?.succession || !instance || !mayLead(warband, faction, game, instance)) return null;
		return {
			keyword: game.succession.keyword.toUpperCase(),
			dead: deadLeaders(warband, faction).map((f) => ({ name: f.name.trim() || 'Unnamed fighter', carried: f.wargear.map(wargearName) }))
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
	 * out, as it is on a fighter never written on, and so are counters at none
	 * where the fighter had none. Fluff as its rules give it is left out as
	 * well, so the card goes on reading the rules' own.
	 */
	function written(fighter: FighterInstance, { name, fluff, notes, tally, wargear, advances, injuries, away }: BackDraft): FighterInstance {
		const { fluff: _fluff, notes: _notes, tally: _tally, advances: _advances, injuries: _injuries, away: _away, ...rest } = fighter;
		const counted = Object.fromEntries(Object.entries(tally).filter(([key, value]) => value !== 0 || fighter.tally?.[key] !== undefined));
		const own = fluff.trim() === givenFluff(fighter) ? '' : fluff.trim();
		return {
			...rest,
			name: name.trim(),
			...(own ? { fluff: own } : {}),
			...(notes.trim() ? { notes: notes.trim() } : {}),
			...(Object.keys(counted).length || fighter.tally ? { tally: counted } : {}),
			...(advances.length || fighter.advances ? { advances } : {}),
			...(injuries.length || fighter.injuries ? { injuries } : {}),
			...(away ? { away } : {}),
			wargear
		};
	}

	/* Whether the fighter on the back may be dismissed, where the game keeps a
	   campaign. Not during a battle, and not while pieces moved on the back are
	   still to be written with Done: the stash it hands to would be the old one.
	   Not before the warband's first battle either: nothing is paid for yet, and
	   the builder takes the fighter back at its full price. A dead leader gets
	   no section: it leaves as another takes the lead, which its Equipment
	   section says. */
	const backDismissal = $derived.by((): BackDismissal | null => {
		if (!warband || !system?.game.campaign || !faction || !editingId || editingId === warband.id) return null;
		const instance = warband.fighters.find((f) => f.instanceId === editingId);
		if (!instance || deadLeader(instance) || warband.disbanded) return null;
		const moved = draft.wargear.join() !== instance.wargear.join();
		return {
			carried: instance.wargear.map(wargearName),
			blocked: battle
				? IN_BATTLE
				: !warband.history?.length
					? 'Not fought yet – remove it in the Fighters step, which pays it back in full.'
					: moved
						? 'Equipment was moved on this back – Done first.'
						: null
		};
	});

	/* Dismissing is asked once more in a sheet, as deleting a warband is, with
	   the focus on keeping the fighter, and written at once. */
	let dismissing = $state<{ instanceId: string; name: string; toStash: number[] } | null>(null);
	let dismissError = $state(false);
	/* Written once, however often Dismiss is tapped while the write runs. */
	let dismissBusy = $state(false);
	let dismissOpener: HTMLElement | null = null;

	function askDismiss(toStash: number[]) {
		const card = cards.find((c) => c.kind === 'fighter' && c.instanceId === editingId);
		if (!card || !editingId) return;
		dismissOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dismissError = false;
		dismissing = { instanceId: editingId, name: card.name, toStash };
	}

	async function keepFighter() {
		dismissing = null;
		await tick();
		dismissOpener?.focus();
	}

	/** What the sheet says beyond the fighter leaving: where its equipment goes, and what the warband then lacks – a leader to follow, or disbanding where none can. */
	const dismissNotes = $derived.by(() => {
		if (!dismissing || !warband || !system || !faction) return [];
		const { instanceId, toStash } = dismissing;
		const instance = warband.fighters.find((f) => f.instanceId === instanceId);
		if (!instance) return [];
		const kept = instance.wargear.filter((_, i) => toStash.includes(i)).map(wargearName);
		const gone = instance.wargear.filter((_, i) => !toStash.includes(i)).map(wargearName);
		const before = validate(warband, system.game, faction);
		const after = validate(dismiss($state.snapshot(warband) as Warband, faction, system.game, instanceId, []), system.game, faction);
		/* Disbanding first: it outweighs whatever else the warband then lacks. */
		const short = after
			.filter((i) => i.kind === 'missing' && !before.some((b) => b.code === i.code && b.message === i.message))
			.sort((a, b) => Number(b.short === 'Disbanded') - Number(a.short === 'Disbanded'));
		return [
			...(kept.length ? [`${kept.join(', ')} ${kept.length > 1 ? 'go' : 'goes'} to the stash.`] : []),
			...(gone.length ? [`${gone.join(', ')} ${gone.length > 1 ? 'leave' : 'leaves'} with the fighter.`] : []),
			'Nothing is paid back.',
			...short.map((i) => i.message)
		];
	});

	/* The warband first; only once it is stored does the card leave the deck,
	   and the photo with it. A failed write keeps the sheet open and says so. */
	async function confirmDismiss() {
		if (!dismissing || dismissBusy || !warband || !system || !faction) return;
		const { instanceId, toStash } = dismissing;
		const updated = dismiss($state.snapshot(warband) as Warband, faction, system.game, instanceId, toStash);
		dismissBusy = true;
		const saved = await saveWarband(updated);
		dismissBusy = false;
		if (!saved) {
			dismissError = true;
			return;
		}
		dismissing = null;
		editingId = null;
		warband = updated;
		if (stored.has(instanceId)) {
			showPhoto(instanceId, null);
			savePhoto(updated.id, instanceId, null);
		}
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
		const led = values.lead && backLead && system && faction ? takeLead(updated, faction, system.game, targetId, values.recovered) : updated;
		editingId = null;
		warband = led;
		saveWarband(led);
		if (photoDraft.changed) {
			/* IndexedDB trips over the reactivity proxy, so the photo goes in as a plain object. */
			const photo = photoDraft.photo
				? { ...photoDraft.photo, bytes: photoDraft.photo.bytes.slice(0), crop: { ...photoDraft.photo.crop } }
				: null;
			showPhoto(targetId, photo);
			savePhoto(led.id, targetId, photo);
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
		const fighters = cards.flatMap((c) =>
			c.kind === 'fighter' && !c.hired ? [{ instanceId: c.instanceId, name: c.name, keywordIds: c.keywordIds, away: c.away !== null }] : []
		);
		const hired = (battle?.hired ?? []).map((h, i) => ({
			name: cards.find((c) => c.kind === 'fighter' && c.instanceId === h.instanceId)?.name ?? h.fighterId,
			fee: hiredFees[i] ?? 0
		}));
		aftermath = { ...startAftermath(rules, fighters, battle, warband.history ?? [], hired, underdog), used: faction ? usedInBattle(warband, faction, battle) : {} };
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
	   the Battle menu. A dead leader, still on the roster, spends none. */
	const levels = $derived.by(() => {
		const advancement = system?.game.advancement;
		if (!warband || !faction || !advancement) return [];
		return warband.fighters.flatMap((instance) => {
			const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
			if (!fighter || instance.away === 'dead') return [];
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

	/* Who is hired, in a sheet over the deck while the battle is still being set
	   up. A tap hires or sends away at once, as a tap at the table does; the
	   fees are paid when the battle is written down, so nothing is paid back. */
	let hiringOpen = $state(false);
	/* Whether the talent's roll for half a fee came up, for the next one hired. */
	let rolledHalf = $state(false);
	const halving = $derived(warband && hiring && !battle?.hired.some((h) => h.halved) ? hiring.halving(warband) : null);
	const sum = (fees: number[]) => fees.reduce((total, fee) => total + fee, 0);
	/* The gold left to hire with: the purse, less what the warband is worth and what is hired already. */
	const goldFree = $derived(warband && system && faction ? purse(warband, system.game) - warbandCost(warband, faction) - sum(hiredFees) : 0);

	/* Each one the faction may hire, the official ones ahead of the homebrew and each source's together: hired already with its fee, or what
	   hiring it adds to the fees and whether the gold holds it – more than its own fee where Well-connected's half
	   moves over to it from one hired before. */
	const hireOffers = $derived.by(() => {
		const w = warband;
		if (!w || !hiring || !faction) return [];
		const hired = battle?.hired ?? [];
		const homebrew = (h: (typeof offered)[number]) => Number(h.origin === 'homebrew');
		const source = (h: (typeof offered)[number]) => h.source?.url ?? '';
		return [...offered].sort((a, b) => homebrew(a) - homebrew(b) || source(a).localeCompare(source(b))).map((h) => {
			const held = hired.find((x) => x.fighterId === h.fighter.id) ?? null;
			if (held) return { hireling: h, held, fee: hiredFees[hired.indexOf(held)] ?? 0, refused: null };
			const halved = owedFree ? { free: true as const } : rolledHalf && halving ? { halved: true as const } : {};
			const trial = hiring.fees(w, [...hired, { instanceId: '', fighterId: h.fighter.id, ...halved }]);
			const added = sum(trial) - sum(hiredFees);
			const refused = hiring.refuse?.(w, faction, h, hired) ?? (added > goldFree ? 'Not enough gold' : null);
			return { hireling: h, held, fee: added, refused };
		});
	});

	/* The one whose choice is open under it, such as the Goblin Shaman's role: it is hired with the option tapped. */
	let choosing = $state<string | null>(null);

	function toggleHire(offer: (typeof hireOffers)[number], picks: string[] = []) {
		if (offer.held) {
			if (battle) setBattle(release(battle, offer.held.instanceId));
			return;
		}
		if (offer.refused) return;
		const id = offer.hireling.fighter.id;
		if (offer.hireling.fighter.choices?.length && !picks.length) {
			choosing = choosing === id ? null : id;
			return;
		}
		/* The debt hires before the talent's half is spent, so a half rolled stays for the next one. */
		setBattle(hire(battle, newId(), id, !owedFree && rolledHalf && halving !== null, picks, owedFree));
		if (!owedFree) rolledHalf = false;
		choosing = null;
	}

	function openHiring() {
		const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const menu = active?.closest('[popover]');
		opener = menu ? document.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`) : active;
		rolledHalf = false;
		choosing = null;
		hiringOpen = true;
	}

	async function closeHiring() {
		hiringOpen = false;
		await tick();
		opener?.focus();
	}

	/* Whether the warband is the underdog, asked in a sheet while the battle is
	   being set up: the opponent's reputation in, the bonuses it allows picked. */
	let underdogOpen = $state(false);
	/* As typed, so a figure that makes no underdog – and starts no battle – still says so. */
	let opponentText = $state<number | null>(null);

	function openUnderdog() {
		const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const menu = active?.closest('[popover]');
		opener = menu ? document.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`) : active;
		opponentText = battle?.underdog?.opponent ?? null;
		underdogOpen = true;
	}

	async function closeUnderdog() {
		underdogOpen = false;
		await tick();
		opener?.focus();
	}

	/* An emptied field takes the question back, so the sheet never shows bonuses under no figure. */
	function enterOpponent(value: string) {
		const rules = system?.game.underdog;
		const figure = value.trim() === '' ? null : Number(value);
		if (!rules || !warband || (figure !== null && !Number.isFinite(figure))) return;
		const next = setOpponent(battle, rules, warband, figure === null ? null : Math.max(0, Math.round(figure)));
		if (next !== battle) setBattle(next);
	}

	/* The tables fighters roll on before the battle, as Black Death City's casters
	   prepare their spells: asked in one sheet while the battle is being set up,
	   for every fighter that takes part. */
	let rollsOpen = $state(false);
	const rollers = $derived.by(() => {
		if (!warband || !faction) return [];
		return warband.fighters.flatMap((f) => {
			const fighter = faction!.fighters.find((t) => t.id === f.fighterId);
			if (f.away || !fighter?.beforeBattle?.length) return [];
			return [{ instance: f, fighter, tables: fighter.beforeBattle }];
		});
	});
	const rollsOwed = $derived(rollers.reduce((sum, r) => sum + r.tables.filter((t) => stateOf(battle, r.instance.instanceId).rolled[t.id] === undefined).length, 0));
	const rollsLabel = $derived(`${system?.game.battle?.rolls ?? ''}${rollsOwed ? ` (${rollsOwed} to roll)` : ''}`);

	function openRolls() {
		const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const menu = active?.closest('[popover]');
		opener = menu ? document.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`) : active;
		rollsOpen = true;
	}

	async function closeRolls() {
		rollsOpen = false;
		await tick();
		opener?.focus();
	}

	/** What a result the fighter already picked is, as its choice names it: `signature spell`; null for any other. */
	function pickedAs(instance: FighterInstance, fighter: Fighter, id: string): string | null {
		if (!(instance.picks ?? []).includes(id)) return null;
		return fighter.choices?.find((c) => c.options.some((o) => o.id === id))?.noun?.one ?? 'pick';
	}

	/* The code an opponent scans to see the warband's cards, with the link it
	   holds; `copied` and `failed` say what handing the link on came to. Without
	   a code – a browser that cannot pack the warband, a link too long for one –
	   the sheet says so in its place. */
	let showing = $state<{ url: string; svg: string; result: 'copied' | 'failed' | null } | { error: string } | null>(null);

	async function openShow() {
		if (!warband) return;
		const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const menu = active?.closest('[popover]');
		opener = menu ? document.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`) : active;
		try {
			const url = location.origin + resolve('/view') + '#' + (await toFragment($state.snapshot(warband) as Warband));
			/* Loaded on the first code, so the cards do not carry it. */
			const QRCode = await import('qrcode');
			const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'L', margin: 4 });
			showing = { url, svg, result: null };
		} catch (error) {
			showing = { error: `This browser could not make the code: ${error instanceof Error ? error.message : error}` };
		}
	}

	async function shareShown() {
		if (!showing || 'error' in showing) return;
		const result = await shareLink(showing.url);
		if (showing && !('error' in showing)) showing.result = result === 'copied' || result === 'failed' ? result : null;
	}

	async function closeShow() {
		showing = null;
		await tick();
		opener?.focus();
	}

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	/* The deck's own colour stands in for the card green on the root, where the
	   explanation overlay reads it too. Left again, the green. While the back of
	   the warband card is turned, the colour picked there, so it is not picked
	   blind; Cancel brings back the one stored. */
	$effect(() => {
		const colour = warband && editingId === warband.id ? warbandDraft.colour : warband?.colour;
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

	/*
	 * The deck comes out of its box when the warband is opened from the list or
	 * the app is opened straight onto it – not on coming back from the builder or
	 * the settings, not into a battle, and not where motion is to be kept down
	 * or the box is switched off; `tuckBox` is read with the warband.
	 */
	let boxed = $state(false);
	let unboxed: Promise<void> = Promise.resolve();

	afterNavigate(({ type, from }) => {
		cameFromApp = type !== 'enter';
		const box = (type === 'enter' || from?.route.id === '/') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (box) unboxed = startScreenGone();
		boxed = box;
	});

	const tuck = $derived.by(() => {
		const card = cards[0];
		if (!boxed || !tuckBox || battle || warband?.disbanded || !faction || card?.kind !== 'warband') return null;
		const logo = system?.game.logo;
		return { name: card.name, line: faction.name, logo: logo && asset(`/${logo}`), ready: unboxed };
	});

	/* Decided once the warband is read: a box held back then, as by a battle,
	   does not come later when the battle ends. */
	$effect(() => {
		if (loadedId && boxed && !tuck) boxed = false;
	});

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
		if (dismissing) keepFighter();
		else if (hiringOpen) closeHiring();
		else if (asking) keepPlaying();
		else if (spending) spending = false;
		else if (showing) closeShow();
	}}
/>

<div class="flex h-dvh flex-col" inert={asking !== null || dismissing !== null || hiringOpen || aftermath !== null || (spending && levels.length > 0) || showing !== null}>
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
				onwound={wound}
				onactivated={(instanceId) => setBattle(toggleActivated(battle, instanceId))}
				onwaiting={(instanceId) => setBattle(toggleWaiting(battle, instanceId))}
				onmark={(instanceId, key) => setBattle(toggleMark(battle, instanceId, key))}
				onuse={(instanceId, wargear, on) => setBattle(useItem(battle, instanceId, wargear, on))}
				onunuse={(instanceId, at) => setBattle(unuseItem(battle, instanceId, at))}
				oncount={(delta) => setBattle(adjustCounter(battle, delta))}
				onstart={() => setBattle(start())}
				closed={warband.disbanded ? DISBANDED : null}
				onnext={() => battle && setBattle(nextRound(battle, roundMarks, wavers()))}
				onundo={() => battle && setBattle(undoRound(battle))}
				onend={endBattle}
				oncancelbattle={system.game.aftermath && ((out) => ask('cancel', out))}
				levelsOpen={levels.length}
				levelLabel={system.game.advancement?.label ?? ''}
				healthLabel={system.game.stats.find((s) => s.key === system.game.health)?.label ?? ''}
				onlevels={() => (spending = true)}
				onunderdog={system.game.underdog && settingUp(battle) ? openUnderdog : undefined}
				onhire={offered.length && settingUp(battle) ? openHiring : undefined}
				hireLabel={hiring?.label ?? ''}
				onrolls={rollers.length && system.game.battle?.rolls && settingUp(battle) ? openRolls : undefined}
				{rollsLabel}
				onshow={openShow}
				editing={editingId !== null}
				doneDisabled={backBlocked}
				onedit={edit}
				ondone={done}
				oncancel={() => (editingId = null)}
				{photos}
				{tuck}
				ontucked={() => (boxed = false)}
			>
				{#snippet back(card)}
					{#if card.kind === 'warband' && warband}
						<WarbandBack name={card.name} {warband} {faction} game={system.game} blocked={battle ? IN_BATTLE : null} bind:draft={warbandDraft} />
					{:else}
						<CardBack name={card.name} placeholder={backPlaceholder} bind:draft bind:photo={photoDraft} campaign={backCampaign} renown={backRenown} injuries={backInjuries} lead={backLead}
							equipment={backEquipment}
							dismissal={backDismissal}
							ondismiss={askDismiss}
						/>
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
		offer={system.game.advancement.offer(next.instance, next.fighter, faction!, next.level, warband!)}
		waiting={levels.length - 1}
		onspend={spendLevel}
		onclose={() => (spending = false)}
	/>
{/if}

{#if underdogOpen && warband && system?.game.underdog}
	{@const rules = system.game.underdog}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="underdog-title">
			<h2 id="underdog-title">Underdog</h2>
			<p class="count">Your reputation {rules.reputation(warband)} · {rules.gap} behind for each bonus</p>
			<label class="field-label" for="underdog-opponent">Opponent's reputation</label>
			<input
				id="underdog-opponent"
				class="field-input mb-3"
				type="number"
				inputmode="numeric"
				min="0"
				bind:value={opponentText}
				oninput={(e) => enterOpponent(e.currentTarget.value)}
				use:focusOnMount
			/>
			{#if underdog}
				<p class="mb-3 text-zinc-400">
					{underdog.behind} behind: {underdog.allowed}
					{underdog.allowed === 1 ? 'bonus' : 'bonuses'}, and +{underdog.roll} on every {(system.game.aftermath?.roll.label ?? 'roll').toLowerCase()} in the aftermath.
				</p>
				<div class="max-h-[50dvh] space-y-2 overflow-y-auto">
					{#each rules.bonuses as bonus (bonus.id)}
						{@const on = underdog.picked.some((b) => b.id === bonus.id)}
						{@const blocked = bonusBlocked(rules, warband, battle, bonus)}
						<button
							type="button"
							class="choice"
							aria-pressed={on}
							disabled={blocked !== null}
							onclick={() => setBattle(toggleBonus(rules, warband!, battle, bonus))}
						>
							<span class="block font-semibold">{bonus.name}</span>
							<span class="block text-zinc-400"><RichText text={bonus.text} /></span>
							{#if blocked}
								<span class="block font-semibold" style="color: var(--ui-warn-text)">{blocked}</span>
							{/if}
						</button>
					{/each}
				</div>
			{:else if opponentText !== null}
				<p class="mb-3 text-zinc-400">Not the underdog: {rules.gap} or more behind makes it one.</p>
			{/if}
			<div class="sheet-actions">
				<button type="button" class="btn" onclick={closeUnderdog}>Done</button>
			</div>
		</div>
	</div>
{/if}

{#if rollsOpen && system?.game.battle?.rolls}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="rolls-title">
			<h2 id="rolls-title">{system.game.battle.rolls}</h2>
			<p class="count">Roll a dice for each and tap what it shows.</p>
			<div class="max-h-[60dvh] overflow-y-auto">
				{#each rollers as { instance, fighter, tables } (instance.instanceId)}
					{#each tables as table (table.id)}
						{@const rolled = stateOf(battle, instance.instanceId).rolled[table.id]}
						<p class="field-label" id="roll-{instance.instanceId}-{table.id}">
							{instance.name.trim() ? `${instance.name}, ${fighter.name}` : fighter.name} · {table.name}
						</p>
						<div class="mb-4 space-y-1.5" role="group" aria-labelledby="roll-{instance.instanceId}-{table.id}">
							{#each table.options as option (option.id)}
								{@const known = pickedAs(instance, fighter, option.id)}
								<button
									type="button"
									class="choice"
									aria-pressed={rolled === option.roll}
									onclick={() => setBattle(rollFor(battle, instance.instanceId, table.id, option.roll))}
								>
									<span class="inline-block w-6 font-semibold">{option.roll}</span>{option.name}{#if known}<span class="text-zinc-400">{' '}· {known}, no effect</span>{/if}
								</button>
							{/each}
						</div>
					{/each}
				{/each}
			</div>
			<div class="sheet-actions">
				<button type="button" class="btn" onclick={closeRolls} use:focusOnMount>Done</button>
			</div>
		</div>
	</div>
{/if}

{#if hiringOpen && hiring && system}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="hire-title">
			<h2 id="hire-title">{hiring.label}</h2>
			<p class="count">{goldFree} {system.game.currency} left · paid in the aftermath</p>
			{#if warband && hiring.discount(warband)}
				<p class="notice mb-3">{hiring.discount(warband)}</p>
			{/if}
			{#if owedFree}
				{@const debt = underdog?.picked.find((b) => b.effect === 'free-hire')}
				{@const rescue = warband?.next?.find((n) => n.freeHire)}
				<p class="notice mb-3">{[debt ? `${debt.name} (Underdog)` : '', rescue ? rescue.source : ''].filter(Boolean).join(', ')}: the next one hired costs nothing.</p>
			{/if}
			<div class="max-h-[60dvh] space-y-2 overflow-y-auto">
				{#if halving}
					<button type="button" class="choice" aria-pressed={rolledHalf} onclick={() => (rolledHalf = !rolledHalf)}>
						<span class="block font-semibold">{halving.name}: rolled 4+</span>
						<span class="block text-zinc-400">{halving.holders.join(', ')} – the next one hired costs half.</span>
					</button>
				{/if}
				{#each hireOffers as offer, i (offer.hireling.fighter.id)}
					<!-- A hired sword picks one thing at most, its role. -->
					{@const choice = offer.hireling.fighter.choices?.[0]}
					{@const open = choosing === offer.hireling.fighter.id}
					{@const picked = offer.held ? pickedName(offer.hireling.fighter.id, offer.held.picks) : ''}
					{@const source = offer.hireling.source}
					{@const before = hireOffers[i - 1]?.hireling}
					<!-- A heading for each source, with a link to where its rules can be read. -->
					{#if !before || before.origin !== offer.hireling.origin || before.source?.url !== source?.url}
						<div class="flex items-center justify-between gap-3 {before ? 'pt-4' : ''}">
							<p class="field-label mb-0">{offer.hireling.origin === 'homebrew' ? 'Homebrew' : 'Official'}</p>
							{#if source}
								<a class="inline-flex min-h-11 items-center gap-1 text-zinc-400 underline" href={source.url} target="_blank" rel="noopener"
									>{source.name}<span aria-hidden="true">↗</span></a
								>
							{/if}
						</div>
					{/if}
					<button
						type="button"
						class="choice"
						aria-pressed={choice && !offer.held ? undefined : offer.held !== null}
						aria-expanded={choice && !offer.held ? open : undefined}
						disabled={offer.refused !== null}
						onclick={() => toggleHire(offer)}
					>
						<span class="block font-semibold">{offer.hireling.fighter.name}</span>
						<span class="block text-zinc-400"
							>{#if offer.held}{offer.fee} {system.game.currency}{#if picked}{' '}· {picked}{/if} · hired – tap to send away{:else}+{offer.fee}
								{system.game.currency}{#if choice}{' '}· pick a {choice.noun?.one ?? 'option'}{/if}{/if}</span
						>
						{#if offer.refused}
							<span class="block font-semibold" style="color: var(--ui-warn-text)">{offer.refused}</span>
						{/if}
					</button>
					{#if choice && open && !offer.held}
						<div class="space-y-2 pl-4" role="group" aria-label="{offer.hireling.fighter.name}: {choice.noun?.one ?? 'option'}">
							{#each choice.options as option (option.id)}
								{@const gear = (option.gear ?? []).map((id) => offer.hireling.wargear.find((w) => w.id === id)?.name ?? id)}
								<button type="button" class="choice" onclick={() => toggleHire(offer, [option.id])}>
									<span class="block font-semibold">{option.name}</span>
									{#if gear.length}<span class="block text-zinc-400">{gear.join(', ')}</span>{/if}
								</button>
							{/each}
						</div>
					{/if}
				{/each}
			</div>
			<div class="sheet-actions">
				<button type="button" class="btn" onclick={closeHiring} use:focusOnMount>Done</button>
			</div>
		</div>
	</div>
{/if}

{#if showing}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="show-title">
			<h2 id="show-title">Show to opponent</h2>
			<p class="count">{title} as it is now – without photos, notes, background or past battles</p>
			{#if 'error' in showing}
				<p class="notice">{showing.error}</p>
			{:else}
				<!-- White in either theme, as a camera reads a code: dark on light. -->
				<div class="mx-auto w-full max-w-80 bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label="QR code">
					{@html showing.svg}
				</div>
				{#if showing.result === 'copied'}
					<p class="mt-3 text-zinc-400">Link copied.</p>
				{:else if showing.result === 'failed'}
					<label class="field-label mt-3" for="show-link">Copy the link</label>
					<input id="show-link" class="field-input" readonly value={showing.url} onfocus={(e) => e.currentTarget.select()} />
				{/if}
			{/if}
			<div class="sheet-actions">
				{#if !('error' in showing)}
					<button type="button" class="btn" onclick={shareShown}>Share link</button>
				{/if}
				<button type="button" class="btn" onclick={closeShow} use:focusOnMount>Done</button>
			</div>
		</div>
	</div>
{/if}

{#if dismissing}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="dismiss-title">
			<h2 id="dismiss-title">Dismiss {dismissing.name}?</h2>
			<p class="notice">{dismissNotes.join(' ')}</p>
			{#if dismissError}
				<p class="notice danger">This browser refused to save it – nothing was changed.</p>
			{/if}
			<div class="sheet-actions">
				<button type="button" class="btn" onclick={keepFighter} use:focusOnMount>Keep</button>
				<button type="button" class="btn danger" disabled={dismissBusy} onclick={confirmDismiss}>Dismiss</button>
			</div>
		</div>
	</div>
{/if}

{#if asking && battle}
	{@const verb = asking === 'end' ? 'End' : 'Cancel'}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="drop-title">
			<h2 id="drop-title">{verb} the battle?</h2>
			<p class="count">Round {battle.round}{#if askedOut > 0}{' '}· {askedOut} out of action{/if}</p>
			<p class="notice">
				Wounds, activations and who is out of action are dropped{asking === 'cancel'
					? ', and nobody rolls for renown'
					: ''}. The warband itself does not change.
			</p>
			<div class="sheet-actions">
				<button type="button" class="btn" onclick={keepPlaying} use:focusOnMount>Keep playing</button>
				<button type="button" class="btn danger" onclick={dropBattle}>{verb} battle</button>
			</div>
		</div>
	</div>
{/if}
