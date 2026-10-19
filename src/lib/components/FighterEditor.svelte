<script lang="ts">
	import RichText from '$lib/components/RichText.svelte';
	import type { Faction, FighterInstance, GameSystem, Issue, WargearKind } from '$lib/core/types';
	import { fighterCost, fighterName, formatStat, neverCarried, profileOf } from '$lib/core/warband';
	import { tick } from 'svelte';

	let {
		instance,
		game,
		faction,
		issues,
		blocked,
		paid,
		dead,
		rarity,
		onsearch,
		onbuy,
		onremove
	}: {
		instance: FighterInstance;
		game: GameSystem;
		faction: Faction;
		/** Only the issues that belong to this fighter. */
		issues: Issue[];
		/** What would stop this fighter from being given a piece of wargear, or null. */
		blocked: (wargearId: string) => Issue | null;
		/**
		 * What the fighter carried when the builder was opened on a warband that
		 * has fought, so is paid for: it is dismissed and stashed on the back of
		 * its card, not taken back here at its full price. Null for a fighter that
		 * can still be taken back whole.
		 */
		paid: string[] | null;
		/** Whether it is a dead leader still on the roster, which leaves once another fighter takes the lead. */
		dead: boolean;
		/**
		 * Where a piece marked `found` is looked for at the table between battles,
		 * as Wyrdcry's rarity roll: who may still search, the score a party of so
		 * many needs, how many found copies of a piece are left, and the sides of
		 * the die a single-use piece rolls for its copies. Null where it is only asked about.
		 */
		rarity: {
			searchers: { instanceId: string; name: string }[];
			target: (party: number) => number;
			left: (wargearId: string) => number | null;
			singleUse: number;
		} | null;
		/** Writes a search: the piece, who searched and helped, and how many copies were found – none where it failed. */
		onsearch: (wargearId: string, party: string[], copies: number) => void;
		/** Counts copies of a found piece bought, or put down again – a negative `change`. */
		onbuy: (wargearId: string, change: number) => void;
		onremove: () => void;
	} = $props();

	const KINDS: { kind: WargearKind; label: string }[] = [
		{ kind: 'melee', label: 'Melee weapons' },
		{ kind: 'ranged', label: 'Ranged weapons' },
		{ kind: 'armour', label: 'Armour' },
		{ kind: 'item', label: 'Items' }
	];

	const fighter = $derived(faction.fighters.find((f) => f.id === instance.fighterId));
	const label = $derived(fighterName(instance, faction));
	/* An open choice says so under its own options. */
	const listed = $derived(issues.filter((i) => i.code !== 'fighter-choice' || i.kind === 'excess'));
	const profile = $derived(fighter ? profileOf(instance, fighter) : undefined);

	function nameOf(id: string): string {
		return faction.wargear.find((w) => w.id === id)?.name ?? id;
	}

	function costOf(id: string): number {
		return faction.wargear.find((w) => w.id === id)?.cost ?? 0;
	}

	/* The wargear on offer opens below the list as a checklist, each piece ticked where the fighter carries it. */
	let adding = $state(false);

	const countOf = (id: string) => instance.wargear.filter((w) => w === id).length;
	/* Copies are alike, so any copy beyond those paid for can be put down. */
	const paidOf = (id: string) => paid?.filter((w) => w === id).length ?? 0;

	/* What the fighter could never take is no choice and stays out of the list,
	   unless an older warband carries it and it has to be put down. */
	const never = $derived(fighter ? neverCarried(fighter, faction, game) : new Map<string, string>());

	/** `HERO only: Handgun, Blunderbuss` per reason, or the count where the names would run long. */
	function hints(ids: string[]): string[] {
		const byReason = new Map<string, string[]>();
		for (const id of ids) byReason.set(never.get(id)!, [...(byReason.get(never.get(id)!) ?? []), nameOf(id)]);
		return [...byReason].map(([reason, names]) => `${reason}: ${names.length > 3 ? `${names.length} more` : names.join(', ')}`);
	}

	/* The groups of the list: a piece under its kind, unless it has a heading of
	   its own, such as Wyrdcry's Trading Post – those after the kinds, in the
	   order the faction lists them. */
	const groups = $derived.by(() => {
		if (!fighter) return [];
		const sold = faction.wargear.filter((w) => fighter.wargear.includes(w.id));
		const own = [...new Set(sold.flatMap((w) => (w.group ? [w.group] : [])))];
		return [
			...KINDS.map(({ kind, label }) => ({ label, sold: sold.filter((w) => w.kind === kind && !w.group) })),
			...own.map((label) => ({ label, sold: sold.filter((w) => w.group === label) }))
		].filter((g) => g.sold.length);
	});

	/* A piece found only at the table, by a Rarity roll, is asked about on the
	   first tap, as the Warband Deck asks before it sells one – unless copies
	   found since the battle are still to buy. Where the game keeps the roll,
	   the question picks who searches, and a single-use piece found asks what
	   the die brought. */
	let finding = $state<string | null>(null);
	let party = $state<string[]>([]);
	let rolling = $state(false);

	/** Whether a found piece is none of the warband's yet, so ticking it asks first. */
	const asks = (id: string) => !!faction.wargear.find((w) => w.id === id)?.found && !(rarity?.left(id) ?? 0);

	/* Ticking takes one; unticking puts down every copy. */
	function toggle(id: string, event?: Event) {
		if (!countOf(id) && asks(id) && finding !== id) {
			if (event?.currentTarget instanceof HTMLInputElement) event.currentTarget.checked = false;
			finding = id;
			party = [];
			rolling = false;
			return;
		}
		finding = null;
		if (countOf(id)) {
			onbuy(id, -countOf(id));
			instance.wargear = instance.wargear.filter((w) => w !== id);
		} else {
			onbuy(id, 1);
			instance.wargear.push(id);
		}
	}

	/* Not found, or not looked for: back to the row it was asked about. */
	async function notFound(id: string) {
		finding = null;
		await tick();
		document.getElementById(checkId(id))?.focus();
	}

	/* A search written down: the party used up until the next battle, and the
	   piece bought where it was found; either way back to its row. */
	async function searched(id: string, copies: number) {
		onsearch(id, party, copies);
		if (copies) toggle(id);
		await notFound(id);
	}

	function found(id: string) {
		if (faction.wargear.find((w) => w.id === id)?.singleUse && rarity!.singleUse > 1) rolling = true;
		else searched(id, 1);
	}

	const checkId = (id: string) => `wargear-${instance.instanceId}-${id}`;

	/* A second of the same piece, where the game's carrying rules allow one: two
	   swords to dual wield, a pair of pistols. */
	function pair(id: string) {
		if (countOf(id) > 1) instance.wargear.splice(instance.wargear.lastIndexOf(id), 1);
		else instance.wargear.push(id);
	}

	/* A rolled option is rolled at the table, so the first tap asks whether it
	   was – as the Warband Deck asks for the Rarity roll before a rare piece. */
	let asking = $state<string | null>(null);

	/** `21-23` as the rules print a range of results. */
	const roll = (id: string) => id.replace('-', '–');

	async function choose(id: string) {
		const choice = fighter?.choice;
		if (!choice) return;
		const picks = instance.picks ?? [];
		if (choice.roll && asking !== id && !picks.includes(id)) {
			asking = id;
			return;
		}
		asking = null;
		/* Once full, the oldest pick makes room, so a pick of one is swapped in a single tap. */
		if (picks.includes(id)) instance.picks = picks.filter((p) => p !== id);
		else if (picks.length < choice.pick) instance.picks = [...picks, id];
		else instance.picks = [...picks.slice(1), id];
		await tick();
		document.getElementById(optionId(id))?.focus();
	}

	/* Not rolled: back to the row it was asked about. */
	async function notRolled(id: string) {
		asking = null;
		await tick();
		document.getElementById(optionId(id))?.focus();
	}

	const optionId = (id: string) => `pick-${instance.instanceId}-${id}`;

	function focusOnMount(node: HTMLElement, on = true) {
		if (on) node.focus();
	}
</script>

<article id="fighter-{instance.instanceId}" class="scroll-mt-20 space-y-3 rounded-md border border-zinc-700 bg-zinc-800 p-3">
	<!-- The name takes the full width, so the placeholder fits a long fighter type. -->
	<div>
		<input
			id="fighter-name-{instance.instanceId}"
			class="field-input h-11 scroll-mt-28 font-semibold placeholder:font-normal"
			bind:value={instance.name}
			placeholder="Name your {fighter?.name ?? instance.fighterId}"
			aria-label="Fighter name"
		/>
		<div class="mt-1 flex items-center justify-between gap-2">
			<p class="min-w-0 text-zinc-400">
				{fighter?.name ?? instance.fighterId} · {fighterCost(instance, faction)}&nbsp;{game.currency}
			</p>
			{#if !paid}
				<button
					type="button"
					class="min-h-11 shrink-0 rounded px-3 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
					aria-label="Remove {label}"
					onclick={onremove}>Remove</button
				>
			{/if}
		</div>
	</div>

	{#if fighter}
		<div class="grid gap-1 text-center" style="grid-template-columns: repeat({game.stats.length}, minmax(0, 1fr))">
			{#each game.stats as stat (stat.key)}
				<div>
					<span class="sublabel truncate">
						{#if stat.short}
							<abbr class="no-underline sm:hidden" title={stat.label}>{stat.short}</abbr><span class="hidden sm:inline"
								>{stat.label}</span
							>
						{:else}
							{stat.label}
						{/if}
					</span>
					<span class="block rounded bg-zinc-900 py-1 font-semibold text-zinc-200">
						{formatStat(stat, profile?.[stat.key])}
					</span>
				</div>
			{/each}
		</div>

		{#if fighter.rules.length}
			<details>
				<summary class="cursor-pointer text-zinc-400">
					{fighter.rules.map((r) => r.name).join(', ')}
				</summary>
				{#each fighter.rules as rule (rule.name)}
					<div class="mt-2 text-zinc-300">
						<strong>{rule.name}</strong>
						<RichText text={rule.text} />
					</div>
				{/each}
			</details>
		{/if}

		{#if fighter.choice}
			{@const choice = fighter.choice}
			{@const picks = instance.picks ?? []}
			<section>
				<p class="sublabel">{choice.source ?? choice.roll ?? 'Choose'} · {picks.length} / {choice.pick}</p>
				<div class="mb-2 text-zinc-400"><RichText text={choice.prompt} /></div>
				<!-- A characteristic needs no explaining, so two fit a row; a spell or a
				     row of a table is a paragraph, read before it is picked. -->
				<div class="grid gap-2 {choice.options.every((o) => !o.text) ? 'grid-cols-2' : ''}">
					{#each choice.options as option (option.id)}
						{#if asking === option.id}
							<!-- On the option's own surface, so the buttons stand out from it as they do in a sheet. -->
							<div
								class="rounded-md border p-3"
								style="background: var(--ui-surface); border-color: var(--ui-border)"
								role="group"
								aria-labelledby="ask-{instance.instanceId}"
							>
								<p id="ask-{instance.instanceId}" class="font-semibold">Rolled {roll(option.id)} on the {choice.roll}?</p>
								<div class="sheet-actions">
									<button type="button" class="btn" onclick={() => notRolled(option.id)}>Not rolled</button>
									<button type="button" class="btn" onclick={() => choose(option.id)} use:focusOnMount>Take it</button>
								</div>
							</div>
						{:else}
							<button
								type="button"
								id={optionId(option.id)}
								class="choice"
								aria-pressed={picks.includes(option.id)}
								onclick={() => choose(option.id)}
							>
								<span class="block font-semibold"
									>{choice.roll ? `${roll(option.id)} ${option.name}` : option.name}{#if option.type}<span
											class="font-normal text-zinc-400">{' · '}{option.type[0].toUpperCase() + option.type.slice(1)}</span
										>{/if}</span
								>
								{#if option.text}<span class="block text-zinc-400"><RichText text={option.text} /></span>{/if}
							</button>
						{/if}
					{/each}
				</div>
				{#if picks.length < choice.pick}
					<p class="mt-2 font-semibold" style="color: var(--ui-warn-text)">Pick {choice.pick} to carry on.</p>
				{/if}
			</section>
		{/if}

		<div>
			{#if fighter.gear.length || instance.wargear.length}
				<ul class="space-y-2">
					{#each fighter.gear as id (id)}
						<li class="wargear-row">
							<span class="wargear-cell wargear-fixed">{nameOf(id)}</span>
							<span class="wargear-cell wargear-fixed wargear-cost">always</span>
							<span></span>
						</li>
					{/each}
					{#each instance.wargear as id, index (index)}
						<li class="wargear-row">
							<span class="wargear-cell">{nameOf(id)}</span>
							<span class="wargear-cell wargear-cost">{costOf(id)}&nbsp;{game.currency}</span>
							{#if countOf(id) > paidOf(id)}
								<button
									type="button"
									class="wargear-remove"
									aria-label="Remove {nameOf(id)} from {label}"
									onclick={() => instance.wargear.splice(index, 1)}><span aria-hidden="true">×</span></button
								>
							{:else}
								<span></span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if fighter.wargear.length}
				<button
					type="button"
					class="wargear-add {fighter.gear.length || instance.wargear.length ? 'mt-2' : ''}"
					aria-expanded={adding}
					aria-controls={adding ? `wargear-${instance.instanceId}` : undefined}
					onclick={() => {
						adding = !adding;
						finding = null;
					}}>{adding ? 'Done' : instance.wargear.length ? 'Change wargear' : '+ Add wargear'}</button
				>
				{#if adding}
					<div id="wargear-{instance.instanceId}" class="mt-3 space-y-3">
						{#each groups as { label: group, sold } (group)}
							{@const options = sold.filter((w) => !never.has(w.id) || countOf(w.id))}
							{@const left = sold.filter((w) => !options.includes(w)).map((w) => w.id)}
							{#if sold.length}
								<fieldset>
									<legend class="sublabel">{group}</legend>
									<!-- One to a row, as the Warband Deck offers wargear, with the reason a
									     piece cannot be taken under its name. A ticked piece can be put
									     down unless the warband already paid for it; an unticked one is
									     refused for what it would break. -->
									{#if options.length}<ul class="checklist">
										{#each options as w (w.id)}
											{@const count = countOf(w.id)}
											{@const left = rarity?.left(w.id) ?? null}
											{@const refused = count ? null : blocked(w.id)}
											<!-- Every copy found is bought, but another search may find more. -->
											{@const block = refused?.code === 'wargear-unfound' && left === 0 && rarity?.searchers.length ? null : refused}
											{@const spent = !count && !!w.found && !!rarity && !left && !rarity.searchers.length}
											{@const kept = paidOf(w.id)}
											<li class="check-row">
												<label class="check-label">
													<input
														id={checkId(w.id)}
														type="checkbox"
														class="h-4 w-4 shrink-0 rounded accent-[#16754A]"
														checked={count > 0}
														disabled={!!block || kept > 0 || spent}
														onchange={(event) => toggle(w.id, event)}
													/>
													<span class="check-name">{w.name}</span>
													<span class="check-cost">{w.cost}&nbsp;{game.currency}</span>
												</label>
												{#if count > 1 || (count === 1 && !blocked(w.id))}
													<button
														type="button"
														class="check-pair"
														aria-pressed={count > 1}
														disabled={count > 1 && kept >= count}
														aria-label="Carry two {w.name}"
														onclick={() => pair(w.id)}>×2</button
													>
												{/if}
												{#if block}<span class="check-why">{block.short}</span>
												{:else if kept}<span class="check-why">Paid for – to the stash on its card</span>
												{:else if spent}<span class="check-why">Rare – every {game.rarity?.keyword.toUpperCase()} has searched</span>
												{:else if left}<span class="check-why">Found – {left} left</span>
												{:else if w.found && !count}<span class="check-why">Rare – {w.found} first</span>{/if}
												{#if finding === w.id}
													<!-- On the row's own surface, as the question for a rolled option. -->
													<div class="check-ask" role="group" aria-labelledby="find-{checkId(w.id)}">
														{#if !rarity}
															<p id="find-{checkId(w.id)}" class="font-semibold">Found {w.name} with {w.found}?</p>
															<div class="sheet-actions">
																<button type="button" class="btn" onclick={() => notFound(w.id)}>Not found</button>
																<button type="button" class="btn" onclick={() => toggle(w.id)} use:focusOnMount
																	>Found – buy for {w.cost}&nbsp;{game.currency}</button
																>
															</div>
														{:else if rolling}
															<p id="find-{checkId(w.id)}" class="font-semibold">How many did the d{rarity.singleUse} bring?</p>
															<div class="sheet-actions">
																{#each Array.from({ length: rarity.singleUse }, (_, i) => i + 1) as copies (copies)}
																	<button type="button" class="btn" onclick={() => searched(w.id, copies)} use:focusOnMount={copies === 1}
																		>{copies}</button
																	>
																{/each}
															</div>
														{:else}
															{@const keyword = game.rarity?.keyword.toUpperCase()}
															<p id="find-{checkId(w.id)}" class="font-semibold">Who looks for {w.name}?</p>
															<p class="text-zinc-400">Each {keyword} beyond the first adds 1 to the roll.</p>
															<div class="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Search party">
																{#each rarity.searchers as searcher, i (searcher.instanceId)}
																	<button
																		type="button"
																		class="choice"
																		use:focusOnMount={i === 0}
																		aria-pressed={party.includes(searcher.instanceId)}
																		onclick={() =>
																			(party = party.includes(searcher.instanceId)
																				? party.filter((p) => p !== searcher.instanceId)
																				: [...party, searcher.instanceId])}>{searcher.name}</button
																	>
																{/each}
															</div>
															<p class="mt-2 font-semibold">
																{party.length ? `Roll ${rarity.target(party.length)}+ – a 1 always fails.` : `Pick the ${keyword} who searches.`}
															</p>
															<div class="sheet-actions">
																<button type="button" class="btn" disabled={!party.length} onclick={() => searched(w.id, 0)}>Not found</button>
																<button type="button" class="btn" disabled={!party.length} onclick={() => found(w.id)}>Found</button>
															</div>
															<!-- Not rolled: nothing is used up. -->
															<button
																type="button"
																class="-ml-3 mt-2 min-h-11 rounded px-3 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
																onclick={() => notFound(w.id)}>Cancel</button
															>
														{/if}
													</div>
												{/if}
											</li>
										{/each}
									</ul>{/if}
									{#each hints(left) as hint (hint)}
										<p class="check-hint">{hint}</p>
									{/each}
								</fieldset>
							{/if}
						{/each}
					</div>
				{/if}
			{:else if fighter.unequipped}
				<p class="text-zinc-400 {fighter.gear.length ? 'mt-2' : ''}">{fighter.unequipped}.</p>
			{/if}
		</div>
	{/if}

	{#if dead}
		<p class="text-zinc-400">
			Dead – it leaves the roster once a {game.succession?.keyword.toUpperCase() ?? 'fighter'} takes the lead on the back of that fighter's card, its
			equipment to the stash on a 3+.
		</p>
	{:else if paid}
		<p class="text-zinc-400">Paid for – dismiss it, or put what it carries in the stash, on the back of its card.</p>
	{/if}

	{#if listed.length}
		<ul style="color: var(--ui-warn-text)">
			{#each listed as issue, i (i)}
				<li>{issue.message}</li>
			{/each}
		</ul>
	{/if}
</article>
