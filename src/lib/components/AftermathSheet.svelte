<script lang="ts">
	import RichText from '$lib/components/RichText.svelte';
	import {
		diesOf,
		earnedOf,
		extraMarksOf,
		fallenLeader,
		goldLeft,
		heirsOf,
		hireFees,
		levelsEarned,
		markReason,
		marksOf,
		rollsOf,
		scoreNeeded,
		singleUseOf,
		stealable,
		staysDead,
		toggleOut,
		toggleUsed,
		usedKey,
		type AftermathDraft,
		type AftermathRow,
		type SurgeonAnswer
	} from '$lib/core/aftermath';
	import { AWAY_LABELS } from '$lib/core/card';
	import { amountAt, pathOf, pickAt, pickEncounter, pickOption, tableOf, uniquesPicked } from '$lib/core/explore';
	import { activeEffects, recruitCost } from '$lib/core/effects';
	import { RESULT_LABELS, displayDate, opponent } from '$lib/core/history';
	import type { Aftermath, BattleRecord, Faction, FindGain, GameSystem, Warband } from '$lib/core/types';

	/*
	 * Ending a battle in pages over the deck, as a level of renown is spent: the
	 * result and the line in the battle history; who was taken out
	 * of action; one page for each of them that rolls for injuries; who takes
	 * the lead, where the leader dies; the
	 * single-use pieces used up, where a fighter carries any; the
	 * roll each fighter makes for renown; the encounter of the search party,
	 * where the game sends one out; then the shards and the income, the finds
	 * counted in. The dice are rolled at the table and the result tapped
	 * here. Apply on the last page writes it all at once; Keep playing on the
	 * first drops the answers and goes back to the battle. Each page is the back
	 * of a card, as a fighter's back is written on, with its answers at its foot.
	 */
	let {
		warband,
		faction,
		game,
		rules,
		draft = $bindable(),
		onapply,
		onclose
	}: {
		/** The warband as it stands before the battle is written in. */
		warband: Warband;
		faction: Faction;
		game: GameSystem;
		rules: Aftermath;
		draft: AftermathDraft;
		onapply: () => void | Promise<void>;
		onclose: () => void;
	} = $props();

	const earned = $derived(earnedOf(warband, game, faction, draft));
	/* The marks beyond the first, and the marks that stand – both follow who came through the battle. */
	const extra = $derived(extraMarksOf(warband, rules, draft));
	const marks = $derived(marksOf(draft, extra));
	const injuries = $derived(game.injuries);

	const nameOf = (instanceId: string) => warband.fighters.find((f) => f.instanceId === instanceId)?.name.trim() || 'Unnamed fighter';

	/* Each fighter out of action with its type, in the warband's order. */
	const outFighters = $derived(
		warband.fighters.flatMap((instance) => {
			const type = faction.fighters.find((f) => f.id === instance.fighterId);
			return draft.out.includes(instance.instanceId) && type ? [{ instance, type }] : [];
		})
	);
	const rolling = $derived(
		injuries
			? outFighters.flatMap(({ instance, type }) => {
					const table = injuries.table(instance, type, faction);
					return table ? [{ instance, type, table }] : [];
				})
			: []
	);
	/* Out of action and never rolling, with the rule that says so. */
	const exempt = $derived(
		injuries
			? outFighters.flatMap(({ instance, type }) => {
					const rule = injuries.exempt(instance, type, faction);
					return rule ? [`${nameOf(instance.instanceId)} (${rule})`] : [];
				})
			: []
	);

	/* The leader, where the injuries kill it, and who may take its place. */
	const fallen = $derived(fallenLeader(warband, game, faction, draft));
	const heirs = $derived(heirsOf(warband, game, faction, draft));

	/* Who carries a single-use piece, asked after the injuries, so a fighter that dies is known not to roll for one. */
	const carrying = $derived(singleUseOf(warband, faction));

	/* Pages come and go as fighters are taken out of action or brought back; a page is held by its key, not its place. */
	const pages = $derived([
		'battle',
		...(injuries ? ['out', ...rolling.map((r) => `roll:${r.instance.instanceId}`)] : []),
		...(fallen ? ['leader'] : []),
		...(carrying.length ? ['items'] : []),
		'renown',
		...(rules.explore ? ['explore'] : []),
		'income'
	]);
	let page = $state('battle');
	const at = $derived(Math.max(0, pages.indexOf(page)));
	const current = $derived(pages[at]);
	const roller = $derived(rolling.find((r) => `roll:${r.instance.instanceId}` === current) ?? null);

	const step = (by: number) => (page = pages[Math.min(pages.length - 1, Math.max(0, at + by))]);

	function pick(result: BattleRecord['result']) {
		draft.result = draft.result === result ? null : result;
	}

	/* A tap picks the result; a tap on the picked one takes it back, and with it what was answered after it. */
	function roll(instanceId: string, id: string) {
		if (draft.injuries[instanceId] === id) delete draft.injuries[instanceId];
		else draft.injuries[instanceId] = id;
		delete draft.recovered[instanceId];
		delete draft.surgeon[instanceId];
	}

	function setSurgeon(instanceId: string, answer: SurgeonAnswer) {
		if (draft.surgeon[instanceId] === answer) delete draft.surgeon[instanceId];
		else draft.surgeon[instanceId] = answer;
	}

	/* A tap picks what the roll came to; a tap on the picked answer takes it back. */
	function setAfterUse(key: string, hit: boolean) {
		if (draft.afterUse[key] === hit) delete draft.afterUse[key];
		else draft.afterUse[key] = hit;
	}

	const wargearName = (id: string) => faction.wargear.find((w) => w.id === id)?.name ?? id;

	/* The encounters under the rules' headings, in their order. */
	const groups = $derived(
		rules.explore
			? [...new Set(rules.explore.encounters.map((e) => e.group))].map((name) => ({ name, encounters: rules.explore!.encounters.filter((e) => e.group === name) }))
			: []
	);
	/* A unique piece is found once in the campaign: one the warband holds, or one found elsewhere in this exploration, is rolled again. */
	const held = $derived(new Set([...(warband.stash ?? []), ...warband.fighters.flatMap((f) => f.wargear)]));
	function uniqueBlocked(id: string, at: string): string | null {
		if (draft.explore.picks[at] === id) return null;
		if (held.has(id)) return 'Already yours – roll again';
		return rules.explore && uniquesPicked(rules.explore, draft.explore).includes(id) ? 'Found in this exploration – roll again' : null;
	}
	/* What an answer costs, such as the charlatan's concoction: paid before the income, from the gold left, as a surgeon is. */
	const costOf = (gains: FindGain[]) => gains.reduce((sum, g) => sum + ('gold' in g && typeof g.gold === 'number' && g.gold < 0 ? -g.gold : 0), 0);
	/* The count a gain asks to be rolled for, such as d3 × 10 gold; undefined where it is fixed. */
	const rolledOf = (gain: FindGain) => {
		const amount = 'gold' in gain ? gain.gold : 'shards' in gain ? gain.shards : 'wargear' in gain ? gain.copies : undefined;
		return typeof amount === 'object' ? amount : undefined;
	};

	/* Who an injury keeps out of this battle, such as a capture: not in the list of who was taken out of action. */
	const present = $derived(warband.fighters.filter((f) => !f.away));
	const sittingOut = $derived(warband.fighters.flatMap((f) => (f.away ? [`${nameOf(f.instanceId)} (${AWAY_LABELS[f.away]})`] : [])));

	/*
	 * A tap marks the fighter, a second tap takes the mark back, and with it a
	 * level tapped for the second roll. With one mark only, a tap moves it; with
	 * more, a fighter no mark is left for cannot be tapped.
	 */
	function toggleMarked(row: AftermathRow) {
		if (marks.includes(row.instanceId)) draft.marked = marks.filter((id) => id !== row.instanceId);
		else draft.marked = extra.notes.length ? [...marks, row.instanceId] : [row.instanceId];
		const now = marksOf(draft, extra);
		for (const r of draft.rows) {
			const rolls = rollsOf(r, now);
			r.levels = Math.min(r.levels, rolls);
			if ((hits[r.instanceId]?.length ?? 0) > rolls) delete hits[r.instanceId];
		}
	}

	/* A fighter that sat the battle out rolls nothing, and loses its mark. */
	function toggleTookPart(row: AftermathRow) {
		row.tookPart = !row.tookPart;
		if (!row.tookPart) {
			row.levels = 0;
			draft.marked = draft.marked.filter((id) => id !== row.instanceId);
			delete hits[row.instanceId];
		}
	}

	/* Which of a fighter's rolls reached the score, a switch each. The draft
	   keeps only how many did; this keeps which, so switching the first off
	   does not seem to switch off the second. */
	let hits = $state<Record<string, boolean[]>>({});
	const hit = (row: AftermathRow, roll: number) => hits[row.instanceId]?.[roll] ?? roll < row.levels;

	function toggleHit(row: AftermathRow, roll: number, rolls: number) {
		const now = Array.from({ length: rolls }, (_, n) => hit(row, n));
		now[roll] = !now[roll];
		hits[row.instanceId] = now;
		row.levels = now.filter(Boolean).length;
	}

	/* A second tap while the write is still running would write the battle twice. */
	let busy = $state(false);

	async function apply() {
		if (busy) return;
		busy = true;
		try {
			await onapply();
		} finally {
			busy = false;
		}
	}

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}
</script>

<div class="sheet-backdrop">
	<div class="card back sheet" role="dialog" aria-modal="true" aria-labelledby="aftermath-title">
		{#snippet finds(gains: FindGain[], path: string)}
			<!-- What a find asks to be rolled for, under it: a row of a loot table, a unique piece, a count. What a
			     row tapped asks in turn follows the table rather than sitting inside the row, so the rolls stay one deep. -->
			{#each gains as gain, i (i)}
				{@const at = pathOf(path, i)}
				{@const rolled = rolledOf(gain)}
				{@const table = 'table' in gain && rules.explore ? tableOf(rules.explore, gain.table) : undefined}
				{#if table}
					<p class="caption" id="table-{at}">{table.name} · {table.dice}</p>
					<div class="results-table" role="group" aria-labelledby="table-{at}">
						{#each table.rows as row (row.roll)}
							{@const open = draft.explore.picks[at] === row.roll}
							<div class="unfold" class:open>
								<button class="unfold-head" aria-pressed={open} onclick={() => pickAt(draft.explore, at, row.roll)}>
									<span class="roll">{row.roll}</span>
									<span class="line">{row.name}</span>
								</button>
								{#if open}
									<div class="unfold-detail">
										<p class="unfold-text"><RichText text={row.text} /></p>
									</div>
								{/if}
							</div>
						{/each}
					</div>
					{@const row = table.rows.find((r) => r.roll === draft.explore.picks[at])}
					{#if row}
						{@render finds(row.gains, at)}
					{/if}
				{:else if 'unique' in gain}
					<p class="caption" id="unique-{at}">{gain.unique.roll}</p>
					<div class="results-table" role="group" aria-labelledby="unique-{at}">
						{#each gain.unique.wargear as id, n (id)}
							{@const blocked = uniqueBlocked(id, at)}
							<div class="unfold" class:open={draft.explore.picks[at] === id}>
								<button class="unfold-head" aria-pressed={draft.explore.picks[at] === id} disabled={blocked !== null} onclick={() => pickAt(draft.explore, at, id)}>
									<span class="roll">{n + 1}</span>
									<span class="line">{wargearName(id)}{blocked ? ` – ${blocked}` : ''}</span>
								</button>
							</div>
						{/each}
					</div>
				{:else if rolled}
					<p class="caption" id="amount-{at}">{rolled.roll}</p>
					<div class="results" role="group" aria-labelledby="amount-{at}">
						{#each rolled.values as value (value)}
							<button class="segment" aria-pressed={draft.explore.amounts[at] === value} onclick={() => amountAt(draft.explore, at, value)}>{value}</button>
						{/each}
					</div>
				{/if}
			{/each}
		{/snippet}

		{#if current === 'battle'}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">End the battle</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<h3 class="heading"><span id="aftermath-result">Result</span><span class="rule"></span></h3>
						<div class="results" role="group" aria-labelledby="aftermath-result">
							{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
								<button class="segment" aria-pressed={draft.result === key} onclick={() => pick(key as BattleRecord['result'])}>{label}</button>
							{/each}
						</div>
						{#if draft.underdog}
							<p class="hint">
								Underdog, {draft.underdog.behind} behind: +{draft.underdog.roll} on every {rules.roll.label.toLowerCase()}{#if draft.underdog.picked.length}{' '}·
									{draft.underdog.picked.map((b) => b.name).join(', ')}{/if}.
							</p>
						{/if}
					</section>

					<section>
						<h3 class="heading"><span>Battle history</span><span class="rule"></span></h3>
						<button class="switch-row" role="switch" aria-checked={draft.record} disabled={!draft.result} onclick={() => (draft.record = !draft.record)}>
							Add to the battle history<span class="track" aria-hidden="true"></span>
						</button>
						{#if draft.recorded}
							{@const r = draft.recorded}
							<p class="note">Already in the history: {displayDate(r.date)} {opponent(r)} – {RESULT_LABELS[r.result]}</p>
						{/if}
						{#if draft.result && draft.record}
							<input class="field" type="text" placeholder="Opponent's warband" aria-label="Opponent's warband" autocomplete="off" bind:value={draft.opponentWarband} />
							<input class="field" type="text" placeholder="Opponent's name" aria-label="Opponent's name" autocomplete="off" bind:value={draft.opponentPlayer} />
						{/if}
					</section>
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={onclose} use:focusOnMount>Keep playing</button>
				<button class="add" disabled={!draft.result} onclick={() => step(1)}>{draft.result ? 'Next' : 'Pick the result'}</button>
			</div>
		{:else if current === 'out'}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">Taken out of action</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<p class="note">Who rolls for injuries. Set from the battle; tap to correct it.</p>
						<div class="toggles" role="group" aria-label="Taken out of action">
							{#each present as fighter (fighter.instanceId)}
								<button class="toggle" aria-pressed={draft.out.includes(fighter.instanceId)} onclick={() => toggleOut(draft, rules, fighter.instanceId)}>
									{nameOf(fighter.instanceId)}
								</button>
							{/each}
						</div>
						{#if sittingOut.length}
							<p class="hint">Sitting this one out: {sittingOut.join(', ')}</p>
						{/if}
						{#if exempt.length}
							<p class="hint">Never roll for injuries: {exempt.join(', ')}</p>
						{/if}
					</section>
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				<button class="add" onclick={() => step(1)} use:focusOnMount>Next</button>
			</div>
		{:else if roller}
			{@const id = roller.instance.instanceId}
			{@const picked = draft.injuries[id]}
			{@const resolution = picked && injuries ? injuries.resolve(roller.instance, roller.type, faction, picked) : null}
			{@const taken = stealable(roller.instance, faction, rules)}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">{nameOf(id)}</h2>
				<p class="page-count">{roller.table.table} · {roller.table.dice} · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<div class="results-table" role="group" aria-label="{roller.table.table} for {nameOf(id)}">
							{#each roller.table.results as result (result.id)}
								{@const open = picked === result.id}
								<div class="unfold" class:open>
									<button class="unfold-head" aria-pressed={open} onclick={() => roll(id, result.id)}>
										<span class="roll">{result.roll}</span>
										<span class="line">{result.name}</span>
									</button>
									<!-- What the result does and asks besides, right under it rather than under the whole table. -->
									{#if open && resolution}
										{@const outcome = resolution.result.outcome}
										{@const cost = resolution.result.cost ?? 0}
										{@const gold = goldLeft(warband, game, faction, draft, id)}
										{@const surgeon = draft.surgeon[id]}
										{@const dies = outcome === 'dead' || surgeon === 'none'}
										{@const bought = roller.instance.wargear.filter((w) => !(draft.stolen[id] && taken.some((t) => t.id === w))).map(wargearName)}
										<div class="unfold-detail">
											{#if resolution.note}
												<p class="unfold-text">{resolution.note}</p>
												<p class="unfold-text"><strong>{resolution.result.name}:</strong> <RichText text={resolution.result.text} /></p>
											{:else}
												<p class="unfold-text"><RichText text={result.text} /></p>
											{/if}

											{#if outcome === 'surgeon'}
												<p class="caption" id="surgeon-{id}">Surgeon</p>
												<div class="toggles stacked" role="group" aria-labelledby="surgeon-{id}">
													<button class="toggle" aria-pressed={surgeon === 'none'} onclick={() => setSurgeon(id, 'none')}>No surgeon – dies</button>
													{#each [{ answer: 'died', label: 'rolled 1–2 – dies, its equipment kept' }, { answer: 'survived', label: 'rolled 3+ – survives' }] as option (option.answer)}
														<button
															class="toggle"
															aria-pressed={surgeon === option.answer}
															disabled={gold < cost}
															onclick={() => setSurgeon(id, option.answer as SurgeonAnswer)}
														>
															Paid {cost} {game.currency}, {option.label}
														</button>
													{/each}
												</div>
												{#if gold < cost}<p class="unfold-text">Only {Math.max(0, gold)} {game.currency} left for a surgeon.</p>{/if}
											{/if}
											{#if dies && staysDead(game, roller.type)}
												<p class="unfold-text">A new leader cannot be chosen in this game, so {nameOf(id)} stays on the roster, marked Dead.</p>
											{:else if dies}
												<p class="caption">Equipment</p>
												{#if bought.length}
													<div class="toggles stacked">
														<button class="toggle" aria-pressed={draft.recovered[id] ?? false} onclick={() => (draft.recovered[id] = !draft.recovered[id])}>
															Recovered on a 3+ – {bought.join(', ')} to the stash
														</button>
													</div>
												{:else}
													<p class="unfold-text">Nothing bought to recover; {nameOf(id)} leaves the roster.</p>
												{/if}
											{:else if outcome === 'robbed'}
												<p class="unfold-text">{bought.length ? `Lost: ${bought.join(', ')}.` : 'Nothing bought to lose.'}</p>
											{:else if outcome === 'captured'}
												<p class="unfold-text">
													Marked Captured until you get {nameOf(id)} back – for half its recruitment cost, {Math.floor(recruitCost(roller.type, activeEffects(warband, faction)) / 2)}
													{game.currency}, or 1 favour – on the back of its card.
												</p>
											{:else if outcome === 'miss-next-battle'}
												<p class="unfold-text">Marked as missing the next battle, until that battle ends.</p>
											{:else if outcome === 'renown'}
												<p class="unfold-text">One more level of renown, to spend after Apply.</p>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</section>
					{#if taken.length && rules.theft}
						<!-- Rolled for whatever the injury, before it: what is stolen is not recovered with the rest. -->
						<section>
							<div class="toggles stacked">
								<button class="toggle" aria-pressed={draft.stolen[id] ?? false} onclick={() => (draft.stolen[id] = !draft.stolen[id])}>
									Stolen on a {rules.theft.target}+ – {taken.map((w) => w.name).join(', ')}
								</button>
							</div>
						</section>
					{/if}
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				<button class="add" onclick={() => step(1)} use:focusOnMount>{picked ? 'Next' : 'Skip'}</button>
			</div>
		{:else if current === 'leader' && fallen}
			{@const keyword = game.succession?.keyword.toUpperCase() ?? ''}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">New leader</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<p class="note">{nameOf(fallen.instanceId)} is dead. A {keyword} takes the LEADER keyword – only the keyword, not the abilities of the leader's own type.</p>
						{#if heirs.length}
							<div class="toggles stacked" role="group" aria-label="New leader">
								{#each heirs as heir (heir.instanceId)}
									<button
										class="toggle"
										aria-pressed={draft.successor === heir.instanceId}
										onclick={() => (draft.successor = draft.successor === heir.instanceId ? null : heir.instanceId)}
									>
										{nameOf(heir.instanceId)}
									</button>
								{/each}
							</div>
							{#if !draft.successor}
								<p class="hint">Left open, a {keyword} can take the lead on the back of its card later.</p>
							{/if}
						{:else}
							<p class="hint">{game.succession?.none}</p>
						{/if}
					</section>
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				<button class="add" onclick={() => step(1)} use:focusOnMount>{draft.successor || !heirs.length ? 'Next' : 'Skip'}</button>
			</div>
		{:else if current === 'items'}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">Single-use items</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<p class="note">What was used up in the battle, as ticked off on the cards. It is struck from the fighter's equipment.</p>
					</section>
					{#each carrying as { instance, pieces } (instance.instanceId)}
						{@const id = instance.instanceId}
						{@const dies = diesOf(draft, game, faction, instance)}
						<section>
							<h3 class="heading"><span>{nameOf(id)}</span><span class="rule"></span></h3>
							<div class="switches" role="group" aria-label="Single-use items of {nameOf(id)}">
								{#each pieces as { index, wargear } (index)}
									<button class="switch-row" role="switch" aria-checked={draft.used[id]?.includes(index) ?? false} onclick={() => toggleUsed(draft, id, index)}>
										{wargear.name} used<span class="track" aria-hidden="true"></span>
									</button>
								{/each}
							</div>
							{#each pieces as { index, wargear } (index)}
								{@const after = rules.afterUse?.find((r) => r.wargear === wargear.id)}
								{@const key = usedKey(id, index)}
								{#if after && draft.used[id]?.includes(index)}
									{#if dies}
										<p class="hint">{nameOf(id)} dies, so there is no {after.label}.</p>
									{:else}
										<p class="note" id="after-{key}">{after.label}</p>
										<div class="results" role="group" aria-labelledby="after-{key}">
											{#each [{ hit: true, label: after.hit }, { hit: false, label: after.miss }] as option (option.label)}
												<button class="segment" aria-pressed={draft.afterUse[key] === option.hit} onclick={() => setAfterUse(key, option.hit)}>
													{option.label}
												</button>
											{/each}
										</div>
									{/if}
								{/if}
							{/each}
						</section>
					{/each}
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				<button class="add" onclick={() => step(1)} use:focusOnMount>Next</button>
			</div>
		{:else if current === 'renown'}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">Renown</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					{#if extra.notes.length || draft.underdog}
						<section>
							{#if draft.underdog}
								<p class="note">Underdog: +{draft.underdog.roll} on every {rules.roll.label.toLowerCase()}, counted into the score each one needs.</p>
							{/if}
							{#each extra.notes as note (note)}
								<p class="note">{note}</p>
							{/each}
						</section>
					{/if}
					{#each draft.rows as row (row.instanceId)}
						{@const levels = levelsEarned(row, marks)}
						{@const rolls = rollsOf(row, marks)}
						{@const blocked = markReason(draft, row, extra)}
						<section>
							<h3 class="heading">
								<span>{row.name}</span><span class="rule"></span>
								<span class="gain" class:none={levels === 0}>+{levels} {levels === 1 ? 'level' : 'levels'}</span>
							</h3>
							<div class="switches" role="group" aria-label="What adds to the {rules.roll.label.toLowerCase()} of {row.name}">
								<button class="switch-row" role="switch" aria-checked={row.tookPart} onclick={() => toggleTookPart(row)}>
									Took part<span class="track" aria-hidden="true"></span>
								</button>
								{#if row.tookPart}
									{#each rules.modifiers as modifier (modifier.key)}
										<button
											class="switch-row"
											role="switch"
											aria-checked={row.answers[modifier.key] ?? false}
											onclick={() =>
												modifier.start === 'not-out' ? toggleOut(draft, rules, row.instanceId) : (row.answers[modifier.key] = !row.answers[modifier.key])}
										>
											{modifier.label}<span class="track" aria-hidden="true"></span>
										</button>
									{/each}
									{#if rules.marked}
										<button
											class="switch-row"
											role="switch"
											aria-checked={marks.includes(row.instanceId)}
											disabled={blocked !== null && extra.notes.length > 0}
											onclick={() => toggleMarked(row)}
										>
											{rules.marked}<span class="track" aria-hidden="true"></span>
										</button>
									{/if}
								{/if}
							</div>
							{#if row.tookPart && blocked && extra.notes.length}
								<p class="hint">{blocked}.</p>
							{/if}
							{#if rolls}
								<!-- The result rather than what adds to it: set off by a rule, a switch for each roll, on where it reached the score. -->
								<div class="switches rolls" role="group" aria-label="{rules.roll.label} of {row.name}">
									{#each Array.from({ length: rolls }, (_, n) => n) as n (n)}
										<button class="switch-row" role="switch" aria-checked={hit(row, n)} onclick={() => toggleHit(row, n, rolls)}>
											{rules.roll.label}{rolls > 1 ? ` ${n + 1}` : ''} · needs {scoreNeeded(row, rules, draft)}+<span class="track" aria-hidden="true"></span>
										</button>
									{/each}
								</div>
							{/if}
						</section>
					{/each}
					{#if draft.excluded.length || sittingOut.length}
						<section>
							{#if draft.excluded.length}
								<p class="hint">Never roll for renown: {draft.excluded.join(', ')}</p>
							{/if}
							{#if sittingOut.length}
								<p class="hint">Sitting this one out: {sittingOut.join(', ')}</p>
							{/if}
						</section>
					{/if}
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				<button class="add" onclick={() => step(1)} use:focusOnMount>Next</button>
			</div>
		{:else if current === 'explore' && rules.explore}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">{rules.explore.label}</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<p class="note">What the exploration roll ran into. Roll at the table and tap it.</p>
						<div class="toggles stacked">
							<button class="toggle" aria-pressed={draft.explore.encounter === null} onclick={() => pickEncounter(draft.explore, null)}>No encounter</button>
						</div>
					</section>
					{#each groups as group (group.name)}
						<section>
							<h3 class="heading"><span id="encounters-{group.name}">{group.name}</span><span class="rule"></span></h3>
							<div class="results-table" role="group" aria-labelledby="encounters-{group.name}">
								{#each group.encounters as e (e.roll)}
									{@const open = draft.explore.encounter === e.roll}
									<div class="unfold" class:open>
										<button class="unfold-head" aria-pressed={open} onclick={() => pickEncounter(draft.explore, e.roll)}>
											<span class="roll">{e.roll}</span>
											<span class="line">{e.name}{e.mishap ? ' – mishap' : ''}</span>
										</button>
										{#if open}
											{@const option = draft.explore.option === null ? undefined : e.ask?.options[draft.explore.option]}
											<div class="unfold-detail">
												<p class="unfold-text"><RichText text={e.text} /></p>
												{@render finds(e.gains, 'e')}
												{#if e.ask}
													<p class="caption" id="ask-{e.roll}">{e.ask.label}</p>
													<div class="toggles stacked" role="group" aria-labelledby="ask-{e.roll}">
														{#each e.ask.options as o, i (i)}
															{@const cost = costOf(o.gains)}
															{@const gold = goldLeft(warband, game, faction, draft, '')}
															{@const short = cost > gold && draft.explore.option !== i}
															<button class="toggle" aria-pressed={draft.explore.option === i} disabled={short} onclick={() => pickOption(draft.explore, i)}>
																{o.label}{cost ? ` – ${cost} ${game.currency}` : ''}{short ? `, only ${Math.max(0, gold)} ${game.currency} left` : ''}
															</button>
														{/each}
													</div>
													{#if option}
														{@render finds(option.gains, `o${draft.explore.option}`)}
													{/if}
												{/if}
												{#if e.byHand || option?.byHand}
													<p class="unfold-text">Part of this the app does not keep yet: note it by hand.</p>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				<button class="add" onclick={() => step(1)} use:focusOnMount>Next</button>
			</div>
		{:else}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">Income</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<div class="counter">
							<span class="label" id="aftermath-shards">Shards delivered</span>
							<div class="stepper" role="group" aria-labelledby="aftermath-shards">
								<button class="segment" aria-label="One shard less" disabled={draft.shards <= 0} onclick={() => (draft.shards -= 1)}>−</button>
								<output class="figure">{draft.shards}</output>
								<button class="segment" aria-label="One shard more" onclick={() => (draft.shards += 1)}>+</button>
							</div>
						</div>
						{#each rules.shardNotes?.(warband) ?? [] as note (note)}
							<p class="hint">{note}</p>
						{/each}
						<!-- One list, so the finds and the fees follow the income under the same rules. -->
						<ul class="list">
							{#each earned.found?.lines ?? [] as line, i (i)}
								<li><span class="line"><span class="gain">{line.gain}</span> {line.why}</span></li>
							{/each}
							{#each earned.lines as line (line.gain)}
								<li><span class="line"><span class="gain">{line.gain}</span> {line.why}</span></li>
							{/each}
							{#if draft.hired.length}
								<li>
									<span class="line"
										><span class="gain">−{hireFees(draft)} {game.currency}</span> – hired for this battle: {draft.hired
											.map((h) => `${h.name} (${h.fee})`)
											.join(', ')}</span
									>
								</li>
							{/if}
						</ul>
						{#each earned.found?.open ?? [] as line, i (i)}
							<p class="hint">Still to roll: {line}.</p>
						{/each}
					</section>
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				<button class="add" disabled={busy} onclick={apply} use:focusOnMount>Apply</button>
			</div>
		{/if}
	</div>
</div>

<style>
	/* The result as one pill of three across the card, as on the back of the warband card; a roll's outcome likewise. */
	.results .segment {
		flex: 1;
	}

	/* What a row earns, in the green the card marks a gain with; a row that
	   earns nothing keeps the place, so the rule does not jump as it is answered. */
	.gain {
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		letter-spacing: 0;
		color: var(--card-green);
		font-variant-numeric: lining-nums tabular-nums;
	}

	.gain.none {
		color: var(--card-ink-muted);
	}

	.results-table {
		display: flex;
		flex-direction: column;
		gap: calc(10 * var(--u));
	}

	/* A loot table inside an encounter: only the row picked is set in bold, not every row under the encounter's. */
	.unfold-detail .unfold:not(.open) .unfold-head .line {
		font-weight: 400;
	}

	/* Wide enough for 41–56, so the names start in one column. */
	.roll {
		flex: none;
		width: 5ch;
		color: var(--card-green);
		font-variant-numeric: lining-nums tabular-nums;
	}
</style>
