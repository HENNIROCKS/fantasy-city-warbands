<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { APP_TITLE } from '$lib/app';
	import FactionInfo from '$lib/components/FactionInfo.svelte';
	import FighterEditor from '$lib/components/FighterEditor.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RichText from '$lib/components/RichText.svelte';
	import Stepper, { type Step } from '$lib/components/Stepper.svelte';
	import { activeEffects, limitOf } from '$lib/core/effects';
	import { loadWarband, saveWarband } from '$lib/core/storage';
	import type { Faction, FighterInstance, Issue, Warband } from '$lib/core/types';
	import { newExcess, validate, warbandCost } from '$lib/core/validate';
	import {
		createWarband,
		fighterCost,
		fighterSections,
		roleOf,
		withFighter,
		withInstance,
		withPicks,
		withWargear
	} from '$lib/core/warband';
	import { planned, systems } from '$lib/systems';

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

	/* Before the DOM updates, so an existing warband never flashes as missing. */
	$effect.pre(() => {
		warband = id ? loadWarband(id) : null;
	});

	$effect(() => {
		if (warband) saveWarband($state.snapshot(warband));
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

	/** Every game for step 1, the planned ones among them, A to Z. */
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
			available: true
		})),
		...planned.map((p) => ({ id: p.id, name: p.name, author: p.author, details: ['Coming later'], available: false }))
	].sort((a, b) => a.name.localeCompare(b.name));

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

	const factionsAtoZ = $derived(system ? [...system.factions].sort((a, b) => a.name.localeCompare(b.name)) : []);

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

	async function pickFaction(factionId: string) {
		const f = system?.factions.find((x) => x.id === factionId);
		if (!system || !f) return;

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
				/* A name that was only the faction's own follows the new faction. */
				if (warband.name === faction?.name) warband.name = f.name;
				warband.factionId = f.id;
				warband.picks = Object.fromEntries(f.choices.map((c) => [c.id, []]));
			}
			goto(url({ id: warband.id, step: 'choice' }));
			return;
		}

		const created = createWarband(system.game.id, f, f.name);
		saveWarband(created);
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
	function blockedBy(after: Warband): Issue | null {
		return system && faction ? newExcess(issues, after, system.game, faction) : null;
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
		if (!warband || !faction) return;
		const index = warband.fighters.findIndex((f) => f.instanceId === instanceId);
		if (index === -1) return;
		const instance = $state.snapshot(warband.fighters[index]);
		const label = instance.name || faction.fighters.find((f) => f.id === instance.fighterId)?.name || 'Fighter';
		warband.fighters.splice(index, 1);
		removed = { instance, index, label };
	}

	function undoRemove() {
		if (!warband || !removed) return;
		warband.fighters = withInstance(warband, removed.instance, removed.index).fighters;
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

	/** The second line of a fighter in the overview: its type where it has a name of its own, then its gear. */
	function overviewLine(instance: FighterInstance): string {
		if (!faction) return '';
		const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
		const gear = [...(fighter?.gear ?? []), ...instance.wargear].map(
			(w) => faction?.wargear.find((x) => x.id === w)?.name ?? w
		);
		return [instance.name ? fighter?.name : null, gear.join(', ') || 'no wargear'].filter(Boolean).join(' · ');
	}

	function next() {
		if (!warband) return;
		const index = STEPS.indexOf(step);
		if (index < STEPS.length - 1) goto(url({ id: warband.id, step: STEPS[index + 1] }));
		else goto(resolve('/'));
	}
</script>

<svelte:head>
	<title>{warband?.name || 'New warband'} · {APP_TITLE}</title>
</svelte:head>

<PageHeader title={warband?.name || 'New warband'} back={resolve('/')} />

<main class="mx-auto max-w-2xl space-y-8 p-5 pb-40 text-sm">
	<Stepper {steps} current={STEPS.indexOf(step)} />

	{#if id && !warband}
		<p class="text-zinc-400">This warband does not exist (any more).</p>
	{:else if step === 'game'}
		<section>
			<p class="field-label">Pick a game</p>
			<div class="space-y-2">
				{#each tiles as tile (tile.id)}
					<button type="button" class="choice px-4 py-5" disabled={!tile.available} onclick={() => pickGame(tile.id)}>
						<span class="block text-base font-semibold">{tile.name}</span>
						<span class="block text-zinc-400">by {tile.author}</span>
						<span class="block text-zinc-400">{tile.details.join(' · ')}</span>
					</button>
				{/each}
			</div>
		</section>
	{:else if step === 'faction'}
		{#if system}
			<section>
				<p class="field-label">Pick a warband</p>
				<div class="space-y-2">
					{#each factionsAtoZ as f (f.id)}
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
										class="min-h-11 w-full rounded bg-[#125E3C] px-6 font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
										onclick={() => pickFaction(f.id)}
									>
										{current
											? `Keep ${f.name}`
											: warband?.fighters.length
												? `Switch to ${f.name}`
												: `Choose ${f.name}`}
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
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
							disabled={!!block}
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
						onremove={() => removeFighter(instance.instanceId)}
					/>
				{/each}
			</div>
		</section>

		<section id="recruit" class="scroll-mt-20">
			<p class="field-label">
				Recruit
				<span class="font-normal normal-case text-zinc-400"
					>· {Math.max(0, system.game.budget - cost)}&nbsp;{system.game.currency} left</span
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
								{@const added = withFighter(warband, f.id)}
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
	{:else if step === 'finish'}
		<section>
			<label class="field-label" for="warband-name">Name</label>
			<input
				id="warband-name"
				class="field-input"
				bind:value={warband.name}
				placeholder={faction.name}
				onblur={() => {
					/* An empty name would leave the warband unnamed in the list; it falls back to the faction's. */
					if (warband && !warband.name.trim()) warband.name = faction?.name ?? 'Warband';
				}}
			/>
		</section>

		<section>
			<p class="field-label">Check</p>
			<div
				class="rounded-md border p-3"
				style={issues.length
					? 'background: var(--ui-warn-bg); border-color: var(--ui-warn-border); color: var(--ui-warn-text)'
					: 'background: var(--ui-sel-bg); border-color: var(--ui-sel-border); color: var(--ui-sel-text)'}
			>
				{#if issues.length === 0}
					This warband is legal.
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
			<ul class="rounded-md border border-zinc-700 bg-zinc-800">
				{#each warband.fighters as instance (instance.instanceId)}
					{@const fighter = faction.fighters.find((f) => f.id === instance.fighterId)}
					<li class="flex gap-3 border-t border-zinc-700 p-3 first:border-t-0">
						<div class="min-w-0 flex-1">
							<span class="block font-semibold text-zinc-200">{instance.name || fighter?.name}</span>
							<span class="block text-zinc-400">{overviewLine(instance)}</span>
						</div>
						<span class="text-zinc-300">{fighterCost(instance, faction)}</span>
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
					<span class="block font-semibold" style={cost > system.game.budget ? 'color: var(--ui-danger-text)' : ''}>
						{cost} / {system.game.budget}&nbsp;{system.game.currency}
					</span>
					{#if issues.length}
						<span class="block underline decoration-dotted underline-offset-2" style="color: var(--ui-warn-text)">
							{`${issues.length} ${excess.length ? `problem${issues.length === 1 ? '' : 's'}` : 'to do'}`}
							<span aria-hidden="true">{showIssues ? '▾' : '▸'}</span>
						</span>
					{:else}
						<span class="block" style="color: var(--ui-sel-text)">legal</span>
					{/if}
				{/snippet}
				{#if issues.length}
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
				{#if step === 'fighters'}
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
