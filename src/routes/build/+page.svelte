<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { APP_TITLE } from '$lib/app';
	import { DEFAULT_COLOUR, PALETTE, readColour, readable } from '$lib/colour';
	import { grow } from '$lib/grow';
	import FactionInfo from '$lib/components/FactionInfo.svelte';
	import FighterEditor from '$lib/components/FighterEditor.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RichText from '$lib/components/RichText.svelte';
	import Stepper, { type Step } from '$lib/components/Stepper.svelte';
	import { areas, coverage } from '$lib/core/coverage';
	import { activeEffects, limitOf } from '$lib/core/effects';
	import { deadLeaders } from '$lib/core/leader';
	import { paidFor } from '$lib/core/manage';
	import { buy, findsOf, leftOf, search, searchers, targetOf } from '$lib/core/finds';
	import { loadWarband, requestPersistence, saveWarband } from '$lib/core/storage.svelte';
	import type { Faction, FighterInstance, Issue, Warband } from '$lib/core/types';
	import { newExcess, purse, validate, warbandCost } from '$lib/core/validate';
	import {
		createWarband,
		fighterCost,
		fighterName,
		fighterSections,
		fighterType,
		roleOf,
		withCopy,
		withFighter,
		withInstance,
		withPicks,
		withWargear
	} from '$lib/core/warband';
	import { planned, systems, upgraded } from '$lib/systems';

	/*
	 * One page for all five steps, the step held in the URL so the back gesture
	 * walks them. Steps 1 and 2 have no warband yet; picking the faction creates
	 * and stores it, and from there on every change is stored as it happens.
	 * Opening an existing warband lands on step 3. Its game is fixed; its faction
	 * can be changed at any time, and since fighters and picks belong to a
	 * faction, a change that would drop them asks first.
	 */
	const STEPS = ['game', 'faction', 'choice', 'fighters', 'finish'] as const;
	type StepId = (typeof STEPS)[number];

	const id = $derived(page.url.searchParams.get('id'));

	let warband = $state<Warband | null>(null);
	/* The id whose read has come back, so a warband still being read never shows as missing. */
	let loadedId = $state<string | null>(null);

	/* What a warband that has fought carried as the builder opened it: paid for,
	   so dismissed and stashed on the back of a card rather than taken back here. */
	let paid = $state<Map<string, string[]> | null>(null);

	/* Fluff or notes asked for while still empty; written in, a field stays open anyway. */
	let writing = $state({ fluff: false, notes: false });

	/* Before the DOM updates, so the warband of the id before is never shown under this one. */
	$effect.pre(() => {
		const current = id;
		warband = null;
		paid = null;
		loadedId = null;
		writing = { fluff: false, notes: false };
		if (!current) return;
		/* A read for an id left meanwhile comes back to nothing. */
		let left = false;
		loadWarband(current).then((stored) => {
			if (left) return;
			const loaded = stored && upgraded(stored);
			/* A name that is only the faction's is no name of the warband's: the field
			   shows it as the placeholder, and the warband card asks for one. */
			if (loaded && loaded.name === systems[loaded.game]?.factions.find((f) => f.id === loaded.factionId)?.name) {
				loaded.name = '';
			}
			warband = loaded;
			paid = loaded ? paidFor(loaded) : null;
			loadedId = current;
		});
		return () => {
			left = true;
		};
	});

	$effect(() => {
		if (warband) saveWarband($state.snapshot(warband));
	});

	/* The deck's colour, null for the card green. */
	const colour = $derived(warband?.colour ?? null);

	/* A field opened by its button takes the focus, so the typing can start –
	   only then, not each time the step is shown again. */
	async function write(field: 'fluff' | 'notes') {
		writing[field] = true;
		await tick();
		document.getElementById(`warband-${field}`)?.focus();
	}

	/** A campaign counter of the warband's one up or down, never below 0. */
	function stepTally(key: string, by: number) {
		if (!warband) return;
		warband.tally = { ...warband.tally, [key]: Math.max(0, (warband.tally?.[key] ?? 0) + by) };
	}

	/* A card's `Unnamed` leads to a name field, which then takes the focus. The
	   warband is read in only after the navigation, so this waits for it, and
	   does it once per arrival. */
	let focusedAt: string | null = null;
	$effect(() => {
		const href = page.url.href;
		const target = page.url.hash.match(/^#(warband-name|fighter-name-.+)$/)?.[1];
		if (!target || !warband || focusedAt === href) return;
		focusedAt = href;
		tick().then(() => document.getElementById(target)?.focus());
	});

	const step = $derived.by((): StepId => {
		const s = page.url.searchParams.get('step') as StepId | null;
		const index = s ? STEPS.indexOf(s) : -1;
		if (id) {
			return index >= 1 ? s! : 'choice';
		}
		return index === 1 && page.url.searchParams.get('game') ? 'faction' : 'game';
	});

	const gameId = $derived(warband?.game ?? page.url.searchParams.get('game'));
	const system = $derived(gameId ? systems[gameId] : null);
	const faction = $derived(system?.factions.find((f) => f.id === warband?.factionId) ?? null);
	const issues = $derived(warband && system && faction ? validate(warband, system.game, faction) : []);
	const cost = $derived(warband && faction ? warbandCost(warband, faction) : 0);
	const gold = $derived(warband && system ? purse(warband, system.game) : (system?.game.budget ?? 0));
	/* Empty while a warband is read, so it does not show as a new one first. */
	const heading = $derived(id && loadedId !== id ? '' : warband?.name.trim() || faction?.name || 'New warband');

	/** Every game for step 1, those still to come among them, A to Z. */
	const tiles = [
		...Object.values(systems).map((s) => ({
			id: s.game.id,
			name: s.game.name,
			author: s.game.author,
			details: [
				s.game.edition,
				`${s.factions.length} faction${s.factions.length === 1 ? '' : 's'}`,
				`${s.game.budget} ${s.game.currencyName ?? s.game.currency}`
			],
			built: coverage(s.game, s.factions),
			available: true
		})),
		/* A game still to come shows its ring with every area open, faint with the disabled tile. */
		...planned.map((p) => ({ id: p.id, name: p.name, author: p.author, details: ['eventually'], built: areas.map(() => false), available: false }))
	].sort((a, b) => a.name.localeCompare(b.name));

	/** One of `count` equal pieces of a ring from radius 8 to 20 around 22,22, the first starting at twelve o'clock. */
	function slice(i: number, count: number): string {
		const at = (n: number, r: number) => {
			const angle = (n / count) * 2 * Math.PI - Math.PI / 2;
			return `${(22 + r * Math.cos(angle)).toFixed(2)} ${(22 + r * Math.sin(angle)).toFixed(2)}`;
		};
		return `M${at(i, 20)}A20 20 0 0 1 ${at(i + 1, 20)}L${at(i + 1, 8)}A8 8 0 0 0 ${at(i, 8)}Z`;
	}

	function url(params: Record<string, string>): string {
		return resolve('/build') + '?' + new URLSearchParams(params).toString();
	}

	const steps = $derived.by((): Step[] => {
		const at = (s: StepId) => (warband ? url({ id: warband.id, step: s }) : null);
		return [
			{ label: 'Game', value: system?.game.name, href: warband ? null : url({}) },
			{ label: 'Warband', value: faction?.name, href: at('faction') },
			{ label: 'Choice', href: at('choice'), incomplete: issues.some((i) => i.code === 'choice') },
			{
				label: 'Fighters',
				value: warband ? `${warband.fighters.length}` : undefined,
				href: at('fighters'),
				incomplete: issues.some((i) => i.code !== 'choice')
			},
			{ label: 'Finish', href: at('finish') }
		];
	});

	/** The faction whose details are open in step 2; one at a time. */
	let openFaction = $state<string | null>(null);

	$effect.pre(() => {
		openFaction = warband?.factionId ?? null;
	});

	/* The official factions A to Z, then the homebrew ones under a heading of their own: at the table it
	   decides whether the opponent can look the faction up. */
	const factionGroups = $derived(
		(['official', 'homebrew'] as const)
			.map((origin) => ({
				origin,
				factions: (system?.factions ?? []).filter((f) => f.origin === origin).sort((a, b) => a.name.localeCompare(b.name))
			}))
			.filter((g) => g.factions.length)
	);

	/** The line under a faction's name in step 2. */
	function factionSummary(f: Faction): string {
		/* A game whose groups set the smallest warband leaves the faction's own minimum at 0. */
		const size =
			f.size.max === null
				? `${f.size.min}+ fighters`
				: f.size.min
					? `${f.size.min}–${f.size.max} fighters`
					: `up to ${f.size.max} fighters`;
		return `${size} · ${f.fighters.length} fighter types`;
	}

	function pickGame(game: string) {
		goto(url({ game, step: 'faction' }));
	}

	/* Switching the faction removes every fighter, which would hand back what was paid for. */
	const switchLocked = $derived(!!warband?.disbanded || (!!paid && !!warband?.fighters.some((f) => paid!.has(f.instanceId))));

	/* A disbanded warband is kept to look at: a new one of its faction starts
	   from nothing, as the game has it, and opens at its choice. */
	/* Started once, however often the button is tapped while the write runs. */
	let starting = $state(false);

	async function startOver() {
		if (!system || !faction || starting) return;
		starting = true;
		const created = createWarband(system.game.id, faction, '');
		const saved = await saveWarband(created);
		if (saved) await requestPersistence();
		starting = false;
		if (saved) goto(url({ id: created.id, step: 'choice' }));
	}

	async function pickFaction(factionId: string) {
		const f = system?.factions.find((x) => x.id === factionId);
		if (!system || !f) return;
		if (warband?.factionId !== f.id && switchLocked) return;

		if (warband) {
			if (warband.factionId !== f.id) {
				const lost = [
					warband.fighters.length ? `your ${warband.fighters.length} fighter${warband.fighters.length === 1 ? '' : 's'}` : null,
					...(faction?.choices ?? [])
						.filter((c) => warband?.picks[c.id]?.length)
						.map((c) => `your ${c.name}`)
				].filter(Boolean);
				const what = lost.join(' and ');
				if (what && !confirm(`Switch to ${f.name}? ${what[0].toUpperCase()}${what.slice(1)} will be removed.`)) return;
				warband.fighters = [];
				/* A name that was only the faction's own is no name of the warband's. */
				if (warband.name === faction?.name) warband.name = '';
				warband.factionId = f.id;
				warband.picks = Object.fromEntries(f.choices.map((c) => [c.id, []]));
			}
			goto(url({ id: warband.id, step: 'choice' }));
			return;
		}

		const created = createWarband(system.game.id, f, '');
		/* Stored before the builder opens it, which reads it back. */
		/* Refused, it stays on this step, under the warning that says why. */
		if (!(await saveWarband(created))) return;
		await requestPersistence();
		/*
		 * Step 2 without a warband becomes step 2 of this one in the history, so
		 * going back from step 3 returns to its faction instead of creating a
		 * second warband.
		 */
		await goto(url({ id: created.id, step: 'faction' }), { replaceState: true });
		goto(url({ id: created.id, step: 'choice' }));
	}

	/**
	 * What would stop a change, or null where it keeps the warband within its
	 * limits. Every control that could take the warband too far asks this
	 * before it is offered, so nothing reaches the list of issues but what is
	 * still missing.
	 */
	/* The rarity roll as the builder's wargear asks it, once the warband has fought. */
	const rarity = $derived.by(() => {
		const game = system?.game;
		if (!game?.rarity || !warband || !faction || warband.disbanded || !findsOf(warband)) return null;
		const current = warband;
		return {
			searchers: searchers(current, faction, game).map((f) => ({ instanceId: f.instanceId, name: fighterName(f, faction!) })),
			target: (party: number) => targetOf(game, party - 1),
			left: (id: string) => leftOf(current, id),
			singleUse: game.rarity.singleUse
		};
	});

	function onsearch(id: string, party: string[], copies: number) {
		if (warband) warband.finds = search($state.snapshot(warband) as Warband, id, party, copies).finds;
	}

	function onbuy(id: string, change: number) {
		if (warband) warband.finds = buy($state.snapshot(warband) as Warband, id, change).finds;
	}

	function blockedBy(after: Warband): Issue | null {
		return system && faction ? newExcess(issues, after, system.game, faction) : null;
	}

	/**
	 * What taking a fighter out would break, such as the GOBLINs an ORC leaves
	 * behind. Only a faction's ratios can be broken by fewer fighters. A limit
	 * the warband breaks already, as an import may, does not stop it: taking
	 * fighters out is how it is put right.
	 */
	function removeBlockedBy(instanceId: string): Issue | null {
		if (!warband || !faction?.ratios?.length) return null;
		const block = blockedBy({ ...warband, fighters: warband.fighters.filter((f) => f.instanceId !== instanceId) });
		return block && !issues.some((i) => i.kind === 'excess' && i.code === block.code) ? block : null;
	}

	/** The picks under a choice once an option is tapped: off again, swapped in, or added. */
	function nextPicks(choiceId: string, optionId: string, pick: number): string[] {
		const picked = warband?.picks[choiceId] ?? [];
		if (picked.includes(optionId)) return picked.filter((x) => x !== optionId);
		if (pick === 1) return [optionId];
		return [...picked, optionId];
	}

	function count(fighterId: string): number {
		return warband?.fighters.filter((f) => f.fighterId === fighterId).length ?? 0;
	}

	/** The last fighter removed, kept so it can be put back where it was. */
	let removed = $state<{ instance: FighterInstance; index: number; label: string } | null>(null);

	/* The offer to undo belongs to the step it was made in. */
	$effect(() => {
		void step;
		removed = null;
	});

	function removeFighter(instanceId: string) {
		if (!warband || !faction || paid?.has(instanceId)) return;
		const index = warband.fighters.findIndex((f) => f.instanceId === instanceId);
		if (index === -1) return;
		const instance = $state.snapshot(warband.fighters[index]);
		const label = fighterName(instance, faction);
		warband.fighters.splice(index, 1);
		for (const id of instance.wargear) onbuy(id, -1);
		removed = { instance, index, label };
	}

	/**
	 * The warband with a copy of the fighter, its found pieces counted as bought,
	 * and what stops it: a rare piece with no copy found since the battle left to
	 * buy, or any excess the copy brings.
	 */
	function copied(instanceId: string): { after: Warband; copy: FighterInstance | null; block: Issue | null } {
		const before = $state.snapshot(warband) as Warband;
		let after = withCopy(before, instanceId, faction!, system!.game);
		const copy = after.fighters.find((f) => !before.fighters.some((g) => g.instanceId === f.instanceId)) ?? null;
		for (const id of copy?.wargear ?? []) {
			const piece = faction!.wargear.find((w) => w.id === id);
			if (piece?.found && findsOf(before) && !leftOf(after, id)) {
				const message = `${piece.name} is rare: no copy found since the last battle is left to buy.`;
				return { after, copy, block: { code: 'wargear-unfound', kind: 'excess', message, short: 'None found left' } };
			}
			after = buy(after, id, 1);
		}
		return { after, copy, block: blockedBy(after) };
	}

	/* The copy falls in at the end of its role, maybe off screen, so the page follows it. */
	async function duplicateFighter(instanceId: string) {
		if (!warband || !faction || !system) return;
		const { after, copy, block } = copied(instanceId);
		if (!copy || block) return;
		warband.fighters = after.fighters;
		warband.finds = after.finds;
		await tick();
		document.getElementById(`fighter-${copy.instanceId}`)?.scrollIntoView({ block: 'nearest' });
	}

	function undoRemove() {
		if (!warband || !removed) return;
		warband.fighters = withInstance(warband, removed.instance, removed.index).fighters;
		for (const id of removed.instance.wargear) onbuy(id, 1);
		removed = null;
	}

	const excess = $derived(issues.filter((i) => i.kind === 'excess'));
	const effects = $derived(warband && faction ? activeEffects(warband, faction) : []);

	/** The recruit tiles under the same headings as the faction's preview. */
	const recruitSections = $derived(system && faction ? fighterSections(faction, system.game) : []);

	/**
	 * The second line of a recruit tile: the role where no heading names it,
	 * cost, the limit where there is one, and how many there are.
	 */
	function recruitLine(f: Faction['fighters'][number], headed: boolean): string {
		if (!system) return '';
		const n = count(f.id);
		const max = limitOf(f, effects).limit.max;
		return [
			headed ? null : roleOf(f, system.game),
			`${f.cost}\u00a0${system.game.currency}`,
			/* A limit of 0 is a fighter the picks rule out; the tile says why instead. */
			max ? `${n} / ${max}` : n > 0 ? `${n} recruited` : null
		]
			.filter(Boolean)
			.join(' · ');
	}

	let showIssues = $state(false);

	/** The second line of a fighter in the overview: its type, then its gear. */
	function overviewLine(instance: FighterInstance): string {
		if (!faction) return '';
		const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
		const gear = [...(fighter?.gear ?? []), ...instance.wargear].map(
			(w) => faction?.wargear.find((x) => x.id === w)?.name ?? w
		);
		return [fighterType(instance, faction), gear.join(', ') || 'no wargear'].join(' · ');
	}

	function next() {
		if (!warband) return;
		const index = STEPS.indexOf(step);
		if (index < STEPS.length - 1) goto(url({ id: warband.id, step: STEPS[index + 1] }));
		else goto(resolve('/'));
	}
</script>

<svelte:head>
	<title>{heading ? `${heading} · ${APP_TITLE}` : APP_TITLE}</title>
</svelte:head>

<PageHeader title={heading} back={resolve('/')} />

<main class="mx-auto max-w-2xl space-y-8 p-5 pb-40 text-sm">
	<Stepper {steps} current={STEPS.indexOf(step)} />

	{#if warband?.disbanded && faction}
		<section class="space-y-3">
			<p class="notice">Disbanded – no HERO was left to lead it. It is kept to look at, and recruits, buys and fights no more.</p>
			<button
				type="button"
				class="min-h-11 w-full rounded bg-[#125E3C] px-6 font-semibold text-white transition enabled:hover:bg-[#16754A] focus-visible:bg-[#16754A] disabled:opacity-50"
				disabled={starting}
				onclick={startOver}>Start a new {faction.name} warband</button
			>
		</section>
	{/if}

	{#if id && loadedId !== id}
		<!-- Read in a moment; nothing to show until then. -->
	{:else if id && !warband}
		<p class="text-zinc-400">This warband does not exist (any more).</p>
	{:else if step === 'game'}
		<section>
			<p class="field-label">Pick a game</p>
			<div class="space-y-2">
				{#each tiles as tile (tile.id)}
					<button
						type="button"
						class="choice flex items-center gap-3 px-4 py-5"
						disabled={!tile.available}
						onclick={() => pickGame(tile.id)}
					>
						<span class="min-w-0 flex-1">
							<span class="block text-base font-semibold">{tile.name}</span>
							<span class="block text-zinc-400">by {tile.author}</span>
							<span class="block text-zinc-400">{tile.details.join(' · ')}</span>
						</span>
						{#if tile.built}
							<svg
								class="size-9 shrink-0"
								viewBox="0 0 44 44"
								role="img"
								aria-label="{tile.built.filter(Boolean).length} of {areas.length} areas built"
							>
								{#each tile.built as built, i (i)}
									<path
										d={slice(i, tile.built.length)}
										fill={built ? 'var(--ui-text)' : 'var(--ui-surface-2)'}
										stroke="var(--ui-surface)"
										stroke-width="1.5"
										stroke-linejoin="round"
									/>
								{/each}
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{:else if step === 'faction'}
		{#if system}
			<section>
				<p class="field-label">Pick a warband</p>
				{#each factionGroups as group (group.origin)}
					{#if group.origin === 'homebrew'}<p class="field-label mt-6">Homebrew</p>{/if}
					<div class="space-y-2">
						{#each group.factions as f (f.id)}
							{@const open = openFaction === f.id}
							{@const current = warband?.factionId === f.id}
							<div
								class="rounded-md border bg-zinc-800 {open || current ? '' : 'border-zinc-700'}"
								style={open || current ? 'border-color: var(--ui-sel-border)' : ''}
							>
								<button
									type="button"
									class="flex min-h-11 w-full items-center gap-3 rounded-md px-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16754A]"
									aria-expanded={open}
									aria-controls="faction-{f.id}"
									onclick={() => (openFaction = open ? null : f.id)}
								>
									<span class="min-w-0 flex-1">
										<span class="block text-base font-semibold text-zinc-200">
											{f.name}
											{#if current}<span class="ml-1 text-xs font-normal" style="color: var(--ui-sel-text)">current</span>{/if}
										</span>
										<span class="block text-zinc-400">{factionSummary(f)}</span>
									</span>
									<span aria-hidden="true" class="text-zinc-400">{open ? '▾' : '▸'}</span>
								</button>
								{#if open}
									<div id="faction-{f.id}" class="space-y-4 border-t border-zinc-700 p-4">
										<FactionInfo faction={f} game={system.game} />
										<button
											type="button"
											class="min-h-11 w-full rounded bg-[#125E3C] px-6 font-semibold text-white transition enabled:hover:bg-[#16754A] focus-visible:bg-[#16754A] disabled:opacity-50"
											disabled={!current && switchLocked}
											onclick={() => pickFaction(f.id)}
										>
											{current
												? `Keep ${f.name}`
												: warband?.fighters.length
													? `Switch to ${f.name}`
													: `Choose ${f.name}`}
										</button>
										{#if !current && switchLocked && !warband?.disbanded}
											<p class="text-zinc-400">This warband has fought: its fighters are paid for. Start a new warband for {f.name}.</p>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/each}
			</section>
		{:else}
			<p class="text-zinc-400">Unknown game. <a class="underline" href={url({})}>Pick one.</a></p>
		{/if}
	{:else if !warband || !system || !faction}
		<!-- Nothing to show until the warband is loaded. -->
	{:else if step === 'choice'}
		{#each faction.choices as choice (choice.id)}
			{@const picked = warband.picks[choice.id] ?? []}
			<section>
				<p class="field-label">
					{choice.name}
					<span class="font-normal normal-case text-zinc-400">{picked.length} / {choice.pick}</span>
				</p>
				<div class="mb-3 text-zinc-400"><RichText text={choice.text} /></div>
				<div class="grid gap-2 sm:grid-cols-2">
					{#each choice.options as option (option.id)}
						{@const on = picked.includes(option.id)}
						{@const next = nextPicks(choice.id, option.id, choice.pick)}
						{@const block = blockedBy(withPicks(warband, choice.id, next))}
						<button
							type="button"
							class="choice"
							aria-pressed={on}
							disabled={!!block || !!warband.disbanded}
							onclick={() => {
								if (warband) warband.picks[choice.id] = next;
							}}
						>
							<span class="block font-semibold">{option.name}</span>
							<span class="block text-zinc-400"><RichText text={option.text} /></span>
							{#if block}
								<!-- On an option the reason lies in the fighters already there, so the whole
								     sentence names them; only a full pick needs no more than its short form. -->
								<span class="mt-1 block font-semibold" style="color: var(--ui-warn-text)">
									{block.code === 'choice' ? block.short : block.message}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</section>
		{:else}
			<p class="text-center text-zinc-400">{faction.name} have nothing to choose here.</p>
		{/each}
	{:else if step === 'fighters'}
		<section>
			<p class="field-label">Your fighters</p>
			{#if warband.fighters.length === 0}
				<p class="text-zinc-400">No fighters yet – recruit them below.</p>
			{/if}
			<div class="space-y-3">
				{#each warband.fighters as instance (instance.instanceId)}
					<FighterEditor
						{instance}
						game={system.game}
						{faction}
						issues={issues.filter((i) => i.instanceId === instance.instanceId)}
						blocked={(wargearId) => blockedBy(withWargear(warband!, instance.instanceId, wargearId))}
						paid={paid?.get(instance.instanceId) ?? null}
						dead={deadLeaders(warband, faction).some((f) => f.instanceId === instance.instanceId)}
						{rarity}
						closed={!!warband.disbanded}
						{onsearch}
						{onbuy}
						onremove={() => removeFighter(instance.instanceId)}
						removeBlocked={removeBlockedBy(instance.instanceId)}
						onduplicate={() => duplicateFighter(instance.instanceId)}
						duplicateBlocked={copied(instance.instanceId).block}
					/>
				{/each}
			</div>
		</section>

		{#if !warband.disbanded}
		<section id="recruit" class="scroll-mt-20">
			<p class="field-label">
				Recruit
				<span class="font-normal normal-case text-zinc-400"
					>· {Math.max(0, gold - cost)}&nbsp;{system.game.currencyName ?? system.game.currency} left</span
				>
			</p>
			<!-- Under the same headings as the faction's preview, two to a row at any width. -->
			<div class="space-y-4">
				{#each recruitSections as section (section.label)}
					<div>
						{#if section.label}
							<p class="pb-1 text-xs font-semibold tracking-wider text-zinc-400 uppercase">{section.label}</p>
						{/if}
						<div class="grid grid-cols-2 gap-2">
							{#each section.fighters as f (f.id)}
								{@const added = withFighter(warband, f.id, faction, system.game)}
								{@const block = blockedBy(added)}
								<button
									type="button"
									class="choice"
									disabled={!!block}
									onclick={() => {
										if (warband) warband.fighters = added.fighters;
									}}
								>
									<span class="block font-semibold">{f.name}</span>
									<span class="block text-zinc-400">{recruitLine(f, !!section.label)}</span>
									{#if block}
										<span class="block font-semibold" style="color: var(--ui-warn-text)">{block.short}</span>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>
		{/if}
	{:else if step === 'finish'}
		<section>
			<label class="field-label" for="warband-name">Name of your warband</label>
			<input
				id="warband-name"
				class="field-input scroll-mt-28"
				bind:value={warband.name}
				placeholder={faction.name}
			/>
		</section>

		<section>
			<p class="field-label">Colour of the cards</p>
			<div class="swatches" role="group" aria-label="Colour of the cards">
				{#each PALETTE as entry (entry.value)}
					<button
						type="button"
						class="swatch"
						style:--swatch={entry.value}
						aria-label={entry.name}
						aria-pressed={(colour ?? DEFAULT_COLOUR) === entry.value}
						onclick={() => {
							if (warband) warband.colour = entry.value === DEFAULT_COLOUR ? null : entry.value;
						}}
					></button>
				{/each}
				<!-- Any colour beyond the palette, through the browser's own picker. -->
				<label
					class="swatch custom"
					class:on={colour !== null && !PALETTE.some((entry) => entry.value === colour)}
					style:--swatch={colour}
				>
					<input
						type="color"
						aria-label="Any colour"
						value={colour ?? DEFAULT_COLOUR}
						oninput={(event) => {
							if (warband) warband.colour = readColour(event.currentTarget.value);
						}}
					/>
				</label>
			</div>
			{#if colour && !readable(colour)}
				<p class="mt-2" style="color: var(--ui-warn-text)">White type on this colour is hard to read on the cards.</p>
			{/if}
		</section>

		<!-- The warband's campaign counters, such as Wyrdcry's favour, for what the
		     aftermath did not count, as the Warband Deck has it in its finish step;
		     under them what the warband card works out from them. -->
		{#if system.game.campaign}
			{@const campaign = system.game.campaign}
			{@const own = new Set(campaign.warband.map((c) => c.key))}
			{@const derived = (campaign.values?.(warband) ?? []).filter((v) => !own.has(v.key))}
			{#each campaign.warband as counter (counter.key)}
				{@const value = warband.tally?.[counter.key] ?? 0}
				<section>
					<p class="field-label" id="tally-{counter.key}">{counter.label}</p>
					<div class="tally-row" role="group" aria-labelledby="tally-{counter.key}">
						<button
							type="button"
							class="tally-step"
							aria-label="Less {counter.label.toLowerCase()}"
							disabled={value <= 0}
							onclick={() => stepTally(counter.key, -1)}>−</button
						>
						<output class="tally-count">{value}</output>
						<button
							type="button"
							class="tally-step"
							aria-label="More {counter.label.toLowerCase()}"
							onclick={() => stepTally(counter.key, 1)}>+</button
						>
					</div>
					{#if derived.length}
						<p class="mt-2 text-zinc-400">{derived.map((v) => `${v.label} ${v.value}`).join(' · ')}</p>
					{/if}
				</section>
			{/each}
		{/if}

		<!-- Fluff and notes for the warband card. Empty, each is a button; once
		     opened or written in, a field that grows with its text. -->
		{@const fluffOpen = writing.fluff || !!warband.fluff?.trim()}
		{@const notesOpen = writing.notes || !!warband.notes?.trim()}
		{#if fluffOpen}
			<section>
				<label class="field-label" for="warband-fluff">Fluff</label>
				<textarea
					id="warband-fluff"
					class="field-input block resize-none"
					rows="2"
					placeholder="A line or two of story"
					bind:value={warband.fluff}
					use:grow
				></textarea>
			</section>
		{/if}
		{#if notesOpen}
			<section>
				<label class="field-label" for="warband-notes">Notes</label>
				<textarea
					id="warband-notes"
					class="field-input block resize-none"
					rows="2"
					placeholder="Anything to remember at the table"
					bind:value={warband.notes}
					use:grow
				></textarea>
			</section>
		{/if}
		{#if !fluffOpen || !notesOpen}
			<div class="flex gap-2">
				{#if !fluffOpen}
					<button type="button" class="wargear-add" onclick={() => write('fluff')}>+ Add fluff</button>
				{/if}
				{#if !notesOpen}
					<button type="button" class="wargear-add" onclick={() => write('notes')}>+ Add notes</button>
				{/if}
			</div>
		{/if}

		<section>
			<p class="field-label">Check</p>
			<div
				class="rounded-md border p-3"
				style={issues.length
					? 'background: var(--ui-warn-bg); border-color: var(--ui-warn-border); color: var(--ui-warn-text)'
					: 'background: var(--ui-sel-bg); border-color: var(--ui-sel-border); color: var(--ui-sel-text)'}
			>
				{#if issues.length === 0}
					This warband is valid.
				{:else}
					<p class="mb-1 font-semibold">{excess.length ? 'Problems' : 'Still to do'}</p>
					<ul class="list-disc space-y-1 pl-5">
						{#each issues as issue, i (i)}
							<li>{issue.message}</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>

		<section>
			<p class="field-label">Overview</p>
			<dl class="mb-3 space-y-1 text-zinc-300">
				<div><dt class="inline text-zinc-400">Game:</dt> <dd class="inline">{system.game.name}</dd></div>
				<div><dt class="inline text-zinc-400">Warband:</dt> <dd class="inline">{faction.name}</dd></div>
				{#each faction.choices as choice (choice.id)}
					<div>
						<dt class="inline text-zinc-400">{choice.name}:</dt>
						<dd class="inline">
							{choice.options
								.filter((o) => warband?.picks[choice.id]?.includes(o.id))
								.map((o) => o.name)
								.join(', ') || '–'}
						</dd>
					</div>
				{/each}
			</dl>
			<ul class="overflow-hidden rounded-md border border-zinc-700 bg-zinc-800">
				{#each warband.fighters as instance (instance.instanceId)}
					<!-- Each row leads back to the fighter's own editor in the fighters step. -->
					<li class="border-t border-zinc-700 first:border-t-0">
						<a
							href={url({ id: warband.id, step: 'fighters' }) + `#fighter-${instance.instanceId}`}
							class="flex gap-3 p-3 transition hover:bg-zinc-700 focus-visible:bg-zinc-700"
						>
							<div class="min-w-0 flex-1">
								<span class="block font-semibold text-zinc-200">{instance.name.trim() || 'Unnamed fighter'}</span>
								<span class="block text-zinc-400">{overviewLine(instance)}</span>
							</div>
							<span class="whitespace-nowrap text-zinc-300">{fighterCost(instance, faction)}&nbsp;{system.game.currency}</span>
							<span aria-hidden="true" class="text-zinc-400">›</span>
						</a>
					</li>
				{:else}
					<li class="p-3 text-zinc-400">No fighters.</li>
				{/each}
			</ul>
			{#if warband.fighters.length}
				<a
					href={resolve('/cards') + `?id=${warband.id}`}
					class="mt-3 flex min-h-11 items-center justify-center rounded border border-zinc-700 px-4 font-semibold text-zinc-200 transition hover:bg-zinc-800 focus-visible:bg-zinc-800"
					>Show cards</a
				>
			{/if}
		</section>
	{/if}
</main>

{#if warband && system && STEPS.indexOf(step) >= 2}
	<footer class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-900">
		<!-- The home indicator of a phone in full-screen use sits on top of the
		     page's bottom edge, hence the safe-area inset under the row. -->
		<div class="mx-auto max-w-2xl px-4 pt-3 text-sm" style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom))">
			<!-- Always in the page, so the button's aria-controls points at it while it is closed too. -->
			<ul
				id="issue-list"
				hidden={!showIssues || !issues.length}
				class="mb-3 max-h-48 list-disc space-y-1 overflow-y-auto rounded-md border py-2 pr-3 pl-7"
				style="background: var(--ui-warn-bg); border-color: var(--ui-warn-border); color: var(--ui-warn-text)"
			>
				{#each issues as issue, i (i)}
					<li>{issue.message}</li>
				{/each}
			</ul>

			{#if removed}
				{@const block = blockedBy(withInstance(warband, removed.instance, removed.index))}
				<div class="mb-3 flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-800 py-1 pr-1 pl-3" role="status">
					<span class="min-w-0 flex-1 truncate">
						{[`${removed.label} removed.`, block ? `${block.short}.` : null].filter(Boolean).join(' ')}
					</span>
					<button
						type="button"
						class="min-h-11 rounded px-4 font-semibold text-zinc-200 transition hover:bg-zinc-700 focus-visible:bg-zinc-700 disabled:opacity-40"
						disabled={!!block}
						onclick={undoRemove}>Undo</button
					>
				</div>
			{/if}

			<div class="flex items-center gap-2">
				{#snippet summary()}
					<span class="block font-semibold" style={cost > gold ? 'color: var(--ui-danger-text)' : ''}>
						{cost} / {gold}&nbsp;{system.game.currency}
					</span>
					{#if warband?.disbanded}
						<!-- Nothing is left to do on a warband that builds no more. -->
						<span class="block text-zinc-400">disbanded</span>
					{:else if issues.length}
						<span class="block underline decoration-dotted underline-offset-2" style="color: var(--ui-warn-text)">
							{`${issues.length} ${excess.length ? `problem${issues.length === 1 ? '' : 's'}` : 'to do'}`}
							<span aria-hidden="true">{showIssues ? '▾' : '▸'}</span>
						</span>
					{:else}
						<span class="block" style="color: var(--ui-sel-text)">valid</span>
					{/if}
				{/snippet}
				{#if issues.length && !warband?.disbanded}
					<!-- The whole summary opens the list, so the target is as large as the text it carries. -->
					<button
						type="button"
						class="-ml-2 min-h-11 min-w-0 flex-1 rounded px-2 text-left transition hover:bg-zinc-800 focus-visible:bg-zinc-800"
						aria-expanded={showIssues}
						aria-controls="issue-list"
						onclick={() => (showIssues = !showIssues)}
					>
						{@render summary()}
					</button>
				{:else}
					<div class="min-w-0 flex-1">{@render summary()}</div>
				{/if}
				{#if step === 'fighters' && !warband?.disbanded}
					<a
						href="#recruit"
						class="flex min-h-11 items-center rounded border border-zinc-700 px-4 font-semibold text-zinc-200 transition hover:bg-zinc-800 focus-visible:bg-zinc-800"
						>Recruit ↓</a
					>
				{/if}
				<button
					type="button"
					class="min-h-11 rounded bg-[#125E3C] px-6 font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
					onclick={next}
				>
					{step === 'finish' ? 'Done' : 'Next'}
				</button>
			</div>
		</div>
	</footer>
{/if}
