<script lang="ts">
	import BattleResult from '$lib/components/BattleResult.svelte';
	import RichText from '$lib/components/RichText.svelte';
	import {
		battleAt,
		diesOf,
		exploreRolls,
		injuryOf,
		earnedOf,
		explorationOf,
		extraMarksOf,
		fallenLeader,
		goldLeft,
		healKey,
		healingOf,
		heirsOf,
		rolledAt,
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
	import { holdingOf, holdingsAfter, incomeOf, jarsFor, levelGained, ordinal } from '$lib/core/holdings';
	import {
		amountAt,
		needsFighter,
		partyBlocked,
		partyFull,
		partyLacks,
		partyMatches,
		partyPath,
		pathOf,
		pickAt,
		pickEncounter,
		pickFighter,
		pickOption,
		recruitPath,
		tableOf,
		toggleParty,
		uniquesPicked,
		type EncounterAnswer,
		type FighterFind
	} from '$lib/core/explore';
	import { activeEffects, recruitCost } from '$lib/core/effects';
	import { newExcess, validate } from '$lib/core/validate';
	import { withFighter } from '$lib/core/warband';
	import type { Aftermath, Encounter, Faction, FighterInstance, FindGain, GameSystem, Warband } from '$lib/core/types';

	/*
	 * Ending a battle in pages over the deck, as a level of renown is spent: the
	 * result and the line in the battle history; who was taken out
	 * of action; one page for each of them that rolls for injuries; who takes
	 * the lead, where the leader dies; the
	 * single-use pieces used up, where a fighter carries any; the
	 * roll each fighter makes for renown, or the experience it earns; the
	 * temporary injuries that heal, where a fighter has any; the search party and its encounters,
	 * where the game sends one out, with a page for each fighter an encounter
	 * sends to the injury table and, where the leader is lost there, one for
	 * its successor; then the shards and the income, the finds counted in, where the game has any. The dice are rolled at the table and the result tapped
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
					return table ? [{ instance, type, table, at: battleAt(instance), source: '', page: `roll:${instance.instanceId}` }] : [];
				})
			: []
	);
	/* Who an encounter of the search party sends to the injury table, after Explore, as the aftermath explores after the injuries. */
	const exploreRolling = $derived.by(() => {
		if (!injuries) return [];
		const rolls = exploreRolls(warband, game, faction, draft);
		const found = earned.found?.fighters ?? [];
		return warband.fighters.flatMap((instance) => {
			const roll = rolls.get(instance.instanceId);
			const type = faction.fighters.find((f) => f.id === instance.fighterId);
			const table = roll && type ? injuries.table(instance, type, faction) : null;
			const source = found.find((f) => f.instanceId === instance.instanceId && f.roll)?.source ?? '';
			return roll && type && table ? [{ instance, type, table, at: roll, source, page: `explore-roll:${instance.instanceId}` }] : [];
		});
	});
	/* Out of action and never rolling, with the rule that says so. */
	const exempt = $derived(
		injuries
			? outFighters.flatMap(({ instance, type }) => {
					const rule = injuries.exempt(instance, type, faction);
					return rule ? [`${nameOf(instance.instanceId)} (${rule})`] : [];
				})
			: []
	);

	/* The leader, where the injuries or the search party's encounters take it, and who may take its place – asked after the step that took it. */
	const fallen = $derived(fallenLeader(warband, game, faction, draft));
	const fallenInBattle = $derived(!!fallen && diesOf(draft, game, faction, fallen));
	const heirs = $derived(heirsOf(warband, game, faction, draft));

	/* Who carries a single-use piece, asked after the injuries, so a fighter that dies is known not to roll for one. */
	const carrying = $derived(singleUseOf(warband, faction));

	/* Pages come and go as fighters are taken out of action or brought back; a page is held by its key, not its place. */
	/* Who came into the battle with a temporary injury that may heal now – one that dies in it heals nothing. */
	const healing = $derived(
		injuries?.recover ? healingOf(warband).filter(({ instance }) => !diesOf(draft, game, faction, instance)) : []
	);

	/* The holdings as the first step leaves them, what the income collects, and who the downtime may leech. */
	const holdings = $derived(game.holdings);
	const counted = $derived(draft.record);
	const after = $derived(holdingsAfter(warband, game, draft.result, draft.seize, earned.found?.holdings));
	const sources = $derived(holdings ? incomeOf(warband, game, faction, after.ids, counted) : []);
	const levelUp = $derived(levelGained(warband, game, counted));
	const leech = $derived(holdings?.leech);
	const jars = $derived(holdings ? jarsFor(warband, game, after.ids, draft.collect) : 0);
	const leechable = $derived(
		leech ? warband.fighters.filter((f) => (f.tally?.[leech.counter] ?? 0) > 0 && f.away !== 'dead' && !diesOf(draft, game, faction, f)) : []
	);
	const upgradeGives = $derived(
		holdings
			? holdings
					.upgrades(faction)
					.filter((u) => [...(warband.upgrades ?? []), ...(levelUp && draft.seize.upgrade ? [draft.seize.upgrade] : [])].includes(u.id))
					.flatMap((u) => (u.gives ?? []).map((g) => `${g.count} ${faction.wargear.find((w) => w.id === g.wargear)?.name ?? g.wargear} (${u.name})`))
			: []
	);

	const pages = $derived([
		'battle',
		...(holdings ? ['seize'] : []),
		...(injuries ? ['out', ...rolling.map((r) => r.page)] : []),
		...(fallenInBattle ? ['leader'] : []),
		...(carrying.length ? ['items'] : []),
		rules.experience ? 'experience' : 'renown',
		...(rules.explore ? ['explore', ...exploreRolling.map((r) => r.page)] : []),
		...(fallen && !fallenInBattle ? ['leader'] : []),
		...(holdings ? ['collect'] : []),
		...(healing.length ? ['recover'] : []),
		...(holdings && (leechable.length || upgradeGives.length) ? ['downtime'] : []),
		...(rules.income ? ['income'] : [])
	]);
	let page = $state('battle');
	const at = $derived(Math.max(0, pages.indexOf(page)));
	const current = $derived(pages[at]);
	/* The last page writes the aftermath, whichever it is. */
	const last = $derived(at === pages.length - 1);
	const rollLabel = $derived(rules.roll?.label ?? '');
	const roller = $derived([...rolling, ...exploreRolling].find((r) => r.page === current) ?? null);

	const step = (by: number) => (page = pages[Math.min(pages.length - 1, Math.max(0, at + by))]);

	/* A tap picks the result; a tap on the picked one takes it back, and with it what was answered after it. */
	function roll(key: string, id: string) {
		if (draft.injuries[key] === id) delete draft.injuries[key];
		else draft.injuries[key] = id;
		delete draft.recovered[key];
		delete draft.surgeon[key];
		delete draft.temporary[key];
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

	/* Who an injury keeps out of this battle, such as a capture: not in the list of who was taken out of action. */
	const present = $derived(warband.fighters.filter((f) => !f.away));

	/* The encounters under the rules' headings, in their order. */
	const groups = $derived(
		rules.explore
			? [...new Set(rules.explore.encounters.map((e) => e.group))].map((name) => ({ name, encounters: rules.explore!.encounters.filter((e) => e.group === name) }))
			: []
	);
	/* The search party, how many encounters it may resolve and the ones that stand. */
	const exploration = $derived(explorationOf(warband, game, faction, draft));
	/* Everyone present, with whether the battle lets them join the search party: a fighter that never rolls for renown is not among the rows, and is asked by its keywords. */
	const explorers = $derived(
		present.map((f) => {
			const row = draft.rows.find((r) => r.instanceId === f.instanceId);
			const keywordIds = row?.keywordIds ?? faction.fighters.find((t) => t.id === f.fighterId)?.keywords ?? [];
			const candidate = { instanceId: f.instanceId, keywordIds, tookPart: row?.tookPart ?? true, out: draft.out.includes(f.instanceId) };
			return { instanceId: f.instanceId, keywordIds, blocked: rules.explore ? partyBlocked(rules.explore, candidate) : null };
		})
	);
	const keywordsOfFighter = (instanceId: string) => explorers.find((f) => f.instanceId === instanceId)?.keywordIds ?? [];
	/* Why a fighter cannot be tapped into the party: barred by the battle, or the party or its place for such a fighter full. */
	function partyReason(instanceId: string, blocked: string | null, keywordIds: string[]): string | null {
		if (exploration?.party.includes(instanceId)) return null;
		if (blocked) return blocked;
		return rules.explore && exploration ? partyFull(rules.explore, exploration.party, keywordsOfFighter, keywordIds) : null;
	}
	/* What the party still lacks of the places the rules ask for. */
	const lacking = $derived(rules.explore && exploration?.party.length ? partyLacks(rules.explore, exploration.party, keywordsOfFighter) : []);
	/* Why an encounter cannot be added: as many as the party may resolve are tapped already. */
	function encounterReason(roll: string): string | null {
		if (!exploration || exploration.most <= 1 || exploration.encounters.some((e) => e.roll === roll)) return null;
		return exploration.encounters.length >= exploration.most ? `${exploration.most} at most` : null;
	}

	/* A unique piece is found once in the campaign: one the warband holds, or one found elsewhere in this exploration, is rolled again. */
	const held = $derived(new Set([...(warband.stash ?? []), ...warband.fighters.flatMap((f) => f.wargear)]));
	function uniqueBlocked(answer: EncounterAnswer, id: string, at: string): string | null {
		if (answer.picks[at] === id) return null;
		if (held.has(id)) return 'Already yours – roll again';
		return rules.explore && exploration && uniquesPicked(rules.explore, exploration.encounters).includes(id) ? 'Found in this exploration – roll again' : null;
	}
	/* The [injury] results a fighter keeps, which an encounter may take away. */
	const injuredWith = (instanceId: string) =>
		(warband.fighters.find((f) => f.instanceId === instanceId)?.injuries ?? []).filter((id) => injuries?.result(id)?.type === 'injury');
	/* Who an encounter may fall on: the search party or the warband, with the keyword and the [injury] it asks for. */
	function whoOf(who: NonNullable<Encounter['who']>): string[] {
		const pool = who.from === 'party' ? (exploration?.party ?? []) : present.map((f) => f.instanceId);
		return pool.filter((id) => {
			const instance = warband.fighters.find((f) => f.instanceId === id);
			const keywords = draft.rows.find((r) => r.instanceId === id)?.keywordIds ?? faction.fighters.find((t) => t.id === instance?.fighterId)?.keywords ?? [];
			return (!who.keyword || keywords.includes(who.keyword)) && !(who.except ?? []).some((k) => keywords.includes(k)) && (!who.injured || injuredWith(id).length > 0);
		});
	}
	/* The fighter types a recruit may be, each with why it cannot join: one that would take the warband past a limit is locked, as recruiting in the builder is. */
	function recruitsOf(recruit: { keyword: string; below: number; ids?: string[] }) {
		const effects = activeEffects(warband, faction);
		const before = validate(warband, game, faction);
		return faction.fighters
			.filter((type) => type.keywords.includes(recruit.keyword) && recruitCost(type, effects) < recruit.below && (!recruit.ids || recruit.ids.includes(type.id)))
			.map((type) => ({ type, cost: recruitCost(type, effects), blocked: newExcess(before, withFighter(warband, type.id, faction, game), game, faction)?.short ?? null }));
	}
	/* What an encounter does to a fighter, as the income page lists it. */
	function fighterLine(find: FighterFind): string {
		const parts = [
			...find.stats.map((s) => `${game.stats.find((d) => d.key === s.key)?.label ?? s.key} ${s.bonus > 0 ? '+' : '−'}${Math.abs(s.bonus)}`),
			...find.injuries.map((id) => injuries?.result(id)?.name ?? id),
			...find.heal.map((id) => `${injuries?.result(id)?.name ?? id} taken away`),
			...(find.levels ? [`+${find.levels} ${find.levels === 1 ? 'level' : 'levels'}`] : []),
			...find.counters.map((c) => `${c.amount > 0 ? '+' : '−'}${Math.abs(c.amount)} ${game.campaign?.fighter.find((d) => d.key === c.key)?.label ?? c.key}`),
			...(find.roll ? ['an injury roll'] : []),
			...(find.remove ? ['leaves the warband'] : [])
		];
		return parts.join(', ');
	}
	/* What a party result brings the fighter it was tapped for, in a few words. */
	function fighterGains(gains: FindGain[]): string {
		return gains
			.flatMap((g) =>
				'counter' in g
					? [`${g.counter.amount > 0 ? '+' : '−'}${Math.abs(g.counter.amount)} ${game.campaign?.fighter.find((d) => d.key === g.counter.key)?.label ?? g.counter.key}`]
					: 'injuryRoll' in g
						? ['an injury roll']
						: 'gold' in g && typeof g.gold === 'number'
							? [`${g.gold} ${game.currency}`]
							: 'wargear' in g
								? [wargearName(g.wargear)]
								: []
			)
			.join(', ');
	}
	/* What an answer costs, such as the charlatan's concoction: paid before the income, from the gold left, as a surgeon is. */
	const costOf = (gains: FindGain[]) => gains.reduce((sum, g) => sum + ('gold' in g && typeof g.gold === 'number' && g.gold < 0 ? -g.gold : 0), 0);
	/* The count a gain asks to be rolled for, such as d3 × 10 gold; undefined where it is fixed. */
	const rolledOf = (gain: FindGain) => {
		const amount = 'gold' in gain ? gain.gold : 'shards' in gain ? gain.shards : 'wargear' in gain ? gain.copies : undefined;
		return typeof amount === 'object' ? amount : undefined;
	};

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
			row.earned = 0;
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

	/* What a fighter stands at before it earns: its counter as its injury result leaves it, with Heroic Escape's experience. */
	function standing(instance: FighterInstance, counter: string): number {
		const type = faction.fighters.find((f) => f.id === instance.fighterId);
		const rolled = rolledAt(draft, instance, battleAt(instance));
		const hurt = injuries && type && rolled ? injuries.apply(instance, type, faction, rolled) : instance;
		return hurt.tally?.[counter] ?? 0;
	}

	/* A tap picks, a second tap takes back – and with the prize, what was taken with it. */
	function pickPrize(id: string) {
		const seize = draft.seize;
		seize.prize = seize.prize === id ? null : id;
		if (draft.result !== 'win') seize.take = seize.prize ? 'prize' : null;
		else if (!seize.prize) seize.take = null;
	}
	const toggleIn = (list: number[], at: number) => (list.includes(at) ? list.filter((n) => n !== at) : [...list, at]);
	/* Silver comes in steps of the roll's multiplier: 5 for `2d6x5`, 1 for `3d6`. */
	const stepOf = (roll: string) => Number(/x(\d+)/.exec(roll)?.[1] ?? 1);
	function addSilver(key: string, by: number) {
		draft.collect.silver[key] = Math.max(0, (draft.collect.silver[key] ?? 0) + by);
	}

	function toggleHealed(key: string) {
		draft.healed = draft.healed.includes(key) ? draft.healed.filter((k) => k !== key) : [...draft.healed, key];
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
		{#snippet finds(answer: EncounterAnswer, gains: FindGain[], path: string)}
			<!-- What a find asks to be rolled for, under it: a row of a loot table, a unique piece, a count. What a
			     row tapped asks in turn follows the table rather than sitting inside the row, so the rolls stay one deep. -->
			{#each gains as gain, i (i)}
				{@const at = pathOf(path, i)}
				{@const rolled = rolledOf(gain)}
				{@const table = 'table' in gain && rules.explore ? tableOf(rules.explore, gain.table) : undefined}
				{#if table}
					<p class="caption" id="table-{answer.roll}-{at}">{table.name} · {table.dice}</p>
					<div class="results-table" role="group" aria-labelledby="table-{answer.roll}-{at}">
						{#each table.rows as row (row.roll)}
							{@const open = answer.picks[at] === row.roll}
							<div class="unfold" class:open>
								<button class="unfold-head" aria-pressed={open} onclick={() => pickAt(answer, at, row.roll)}>
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
					{@const row = table.rows.find((r) => r.roll === answer.picks[at])}
					{#if row}
						{@render finds(answer, row.gains, at)}
					{/if}
				{:else if 'unique' in gain}
					<p class="caption" id="unique-{answer.roll}-{at}">{gain.unique.roll}</p>
					<div class="results-table" role="group" aria-labelledby="unique-{answer.roll}-{at}">
						{#each gain.unique.wargear as id, n (id)}
							{@const blocked = uniqueBlocked(answer, id, at)}
							<div class="unfold" class:open={answer.picks[at] === id}>
								<button class="unfold-head" aria-pressed={answer.picks[at] === id} disabled={blocked !== null} onclick={() => pickAt(answer, at, id)}>
									<span class="roll">{n + 1}</span>
									<span class="line">{wargearName(id)}{blocked ? ` – ${blocked}` : ''}</span>
								</button>
							</div>
						{/each}
					</div>
				{:else if 'recruit' in gain}
					{@const key = recruitPath(at)}
					<p class="caption" id="recruit-{answer.roll}-{at}">Who joins</p>
					<div class="toggles stacked" role="group" aria-labelledby="recruit-{answer.roll}-{at}">
						{#each recruitsOf(gain.recruit) as { type, cost, blocked } (type.id)}
							<button
								class="toggle"
								aria-pressed={answer.picks[key] === type.id}
								disabled={blocked !== null && answer.picks[key] !== type.id}
								onclick={() => pickAt(answer, key, type.id)}
							>
								{type.name} – {gain.recruit.free ? `${cost} ${game.currency}, free` : `${cost} ${game.currency}`}{blocked ? ` – ${blocked}` : ''}
							</button>
						{/each}
					</div>
				{:else if 'holding' in gain}
					{@const holdingTable = holdings?.table.filter((h) => h.id !== holdings.table[0].id) ?? []}
					{@const full = after.ids.length - (earned.found?.holdings.length ?? 0) >= (holdings?.max ?? 0)}
					<p class="caption" id="holding-{answer.roll}-{at}">Holding · {holdings?.dice}</p>
					{#if full && !answer.picks[at]}
						<p class="unfold-text">Already {holdings?.max} holdings: none to take.</p>
					{/if}
					<div class="results-table" role="group" aria-labelledby="holding-{answer.roll}-{at}">
						{#each holdingTable as holding (holding.id)}
							{@const open = answer.picks[at] === holding.id}
							<div class="unfold" class:open>
								<button class="unfold-head" aria-pressed={open} disabled={full && !open} onclick={() => pickAt(answer, at, holding.id)}>
									<span class="roll">{holding.roll}</span>
									<span class="line">{holding.name}</span>
								</button>
								{#if open && holding.text}
									<div class="unfold-detail">
										<p class="unfold-text"><RichText text={holding.text} /></p>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else if 'party' in gain}
					{#each explorers.filter((f) => exploration?.party.includes(f.instanceId) && partyMatches(gain.party, f.keywordIds)) as member (member.instanceId)}
						{@const key = partyPath(at, member.instanceId)}
						{@const result = gain.party.dice === null ? gain.party.results[0] : gain.party.results.find((r) => r.on === answer.picks[key])}
						{#if gain.party.dice === null}
							<p class="hint">{nameOf(member.instanceId)}: {result ? fighterGains(result.gains) : ''}</p>
						{:else}
							<p class="caption" id="party-{answer.roll}-{key}">{nameOf(member.instanceId)} · {gain.party.dice}{result ? ` · ${fighterGains(result.gains) || 'nothing'}` : ''}</p>
							<div class="results" role="group" aria-labelledby="party-{answer.roll}-{key}">
								{#each gain.party.results as r (r.on)}
									<button class="segment" aria-pressed={answer.picks[key] === r.on} onclick={() => pickAt(answer, key, r.on)}>{r.label}</button>
								{/each}
							</div>
						{/if}
						{#if result}
							{@render finds(answer, result.gains.filter((g) => !('counter' in g) && !('injuryRoll' in g)), key)}
						{/if}
					{/each}
				{:else if 'heal' in gain && answer.fighter}
					{@const healed = injuredWith(answer.fighter)}
					<p class="caption" id="heal-{answer.roll}-{at}">The injury taken away</p>
					<div class="toggles stacked" role="group" aria-labelledby="heal-{answer.roll}-{at}">
						{#each healed as id (id)}
							<button class="toggle" aria-pressed={answer.picks[`${at}:heal`] === id} onclick={() => pickAt(answer, `${at}:heal`, id)}>
								{injuries?.result(id)?.name ?? id}
							</button>
						{/each}
					</div>
				{:else if 'each' in gain}
					{@const counted = gain.each.results.reduce((sum, _, n) => sum + (answer.amounts[`${at}#${n}`] ?? 0), 0)}
					{#each gain.each.results as result, n (n)}
						{@const key = `${at}#${n}`}
						{@const mine = answer.amounts[key] ?? 0}
						<p class="caption" id="each-{answer.roll}-{key}">{result.label}</p>
						<div class="results" role="group" aria-labelledby="each-{answer.roll}-{key}">
							{#each Array.from({ length: gain.each.dice + 1 }, (_, v) => v) as value (value)}
								<button
									class="segment"
									aria-pressed={answer.amounts[key] === value}
									disabled={counted - mine + value > gain.each.dice}
									onclick={() => amountAt(answer, key, value)}>{value}</button
								>
							{/each}
						</div>
					{/each}
				{:else if rolled}
					<p class="caption" id="amount-{answer.roll}-{at}">{rolled.roll}</p>
					<div class="results" role="group" aria-labelledby="amount-{answer.roll}-{at}">
						{#each rolled.values as value (value)}
							<button class="segment" aria-pressed={answer.amounts[at] === value} onclick={() => amountAt(answer, at, value)}>{value}</button>
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
					<BattleResult bind:end={draft}>
						{#if draft.underdog && rules.roll}
							<p class="hint">
								Underdog, {draft.underdog.behind} behind: +{draft.underdog.roll} on every {rollLabel.toLowerCase()}{#if draft.underdog.picked.length}{' '}·
									{draft.underdog.picked.map((b) => b.name).join(', ')}{/if}.
							</p>
						{/if}
					</BattleResult>
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
			{@const key = roller.at.key}
			{@const picked = draft.injuries[key]}
			{@const resolution = injuryOf(draft, game, faction, roller.instance, roller.at)}
			{@const read = picked ? roller.at.treat[picked] : undefined}
			{@const taken = roller.at.battle ? stealable(roller.instance, faction, rules) : []}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">{nameOf(id)}</h2>
				<p class="page-count">{roller.source ? `${roller.source} · ` : ''}{roller.table.table} · {roller.table.dice} · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<div class="results-table" role="group" aria-label="{roller.table.table} for {nameOf(id)}">
							{#each roller.table.results as result (result.id)}
								{@const open = picked === result.id}
								<div class="unfold" class:open>
									<button class="unfold-head" aria-pressed={open} onclick={() => roll(key, result.id)}>
										<span class="roll">{result.roll}</span>
										<span class="line">{result.name}</span>
									</button>
									<!-- What the result does and asks besides, right under it rather than under the whole table. -->
									{#if open && resolution}
										{@const outcome = resolution.result.outcome}
										{@const cost = resolution.result.cost ?? 0}
										{@const gold = goldLeft(warband, game, faction, draft, key)}
										{@const surgeon = draft.surgeon[key]}
										{@const dies = outcome === 'dead' || surgeon === 'none'}
										{@const bought = roller.instance.wargear.filter((w) => !(draft.stolen[id] && taken.some((t) => t.id === w))).map(wargearName)}
										<div class="unfold-detail">
											{#if read}
												<p class="unfold-text">{roller.source} reads it as {injuries?.result(read)?.name ?? read}.</p>
											{/if}
											{#if resolution.note}
												<p class="unfold-text">{resolution.note}</p>
												<p class="unfold-text"><strong>{resolution.result.name}:</strong> <RichText text={resolution.result.text} /></p>
											{:else}
												<p class="unfold-text"><RichText text={result.text} /></p>
											{/if}

											{#if outcome === 'surgeon'}
												<p class="caption" id="surgeon-{id}">Surgeon</p>
												<div class="toggles stacked" role="group" aria-labelledby="surgeon-{id}">
													<button class="toggle" aria-pressed={surgeon === 'none'} onclick={() => setSurgeon(key, 'none')}>No surgeon – dies</button>
													{#each [{ answer: 'died', label: 'rolled 1–2 – dies, its equipment kept' }, { answer: 'survived', label: 'rolled 3+ – survives' }] as option (option.answer)}
														<button
															class="toggle"
															aria-pressed={surgeon === option.answer}
															disabled={gold < cost}
															onclick={() => setSurgeon(key, option.answer as SurgeonAnswer)}
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
												{#if bought.length && injuries?.salvage}
													<div class="toggles stacked">
														<button class="toggle" aria-pressed={draft.recovered[key] ?? false} onclick={() => (draft.recovered[key] = !draft.recovered[key])}>
															{injuries.salvage.label} – {bought.join(', ')} to the stash
														</button>
													</div>
												{:else if bought.length}
													<p class="unfold-text">All of it is lost: {bought.join(', ')}. {nameOf(id)} leaves the roster.</p>
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
											{#if injuries?.duration && resolution.result.type === 'injury' && !resolution.note}
												<!-- Rolled for as the injury comes: permanent until the answer says otherwise. -->
												<p class="caption" id="duration-{key}">Permanent or temporary</p>
												<div class="results" role="group" aria-labelledby="duration-{key}">
													<button class="segment" aria-pressed={!draft.temporary[key]} onclick={() => (draft.temporary[key] = false)}>
														{injuries.duration.permanent}
													</button>
													<button class="segment" aria-pressed={draft.temporary[key] === true} onclick={() => (draft.temporary[key] = true)}>
														{injuries.duration.temporary}
													</button>
												</div>
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
						<p class="note">
							{nameOf(fallen.instanceId)} is dead. {game.succession?.note ?? `A ${keyword} takes the LEADER keyword – only the keyword, not the abilities of the leader's own type.`}
						</p>
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
								<p class="note">Underdog: +{draft.underdog.roll} on every {rollLabel.toLowerCase()}, counted into the score each one needs.</p>
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
							<div class="switches" role="group" aria-label="What adds to the {rollLabel.toLowerCase()} of {row.name}">
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
								<div class="switches rolls" role="group" aria-label="{rollLabel} of {row.name}">
									{#each Array.from({ length: rolls }, (_, n) => n) as n (n)}
										<button class="switch-row" role="switch" aria-checked={hit(row, n)} onclick={() => toggleHit(row, n, rolls)}>
											{rollLabel}{rolls > 1 ? ` ${n + 1}` : ''} · needs {scoreNeeded(row, rules, draft)}+<span class="track" aria-hidden="true"></span>
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
		{:else if current === 'experience' && rules.experience}
			{@const experience = rules.experience}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">{experience.label}</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<p class="note">{experience.note}</p>
					</section>
					{#each draft.rows as row (row.instanceId)}
						{@const instance = warband.fighters.find((f) => f.instanceId === row.instanceId)}
						{@const dies = instance ? diesOf(draft, game, faction, instance) : false}
						{@const before = instance ? standing(instance, experience.counter) : 0}
						{@const line = instance && !dies ? (experience.line?.(instance, before, before + row.earned) ?? null) : null}
						{@const besides =
							instance && !dies
								? (experience.besides?.(instance, injuryOf(draft, game, faction, instance)?.result.id ?? null, draft.successor === row.instanceId || !!instance.leader) ?? [])
								: []}
						<section>
							<h3 class="heading">
								<span>{row.name}</span><span class="rule"></span>
								<span class="gain" class:none={row.earned === 0}>+{row.earned} {experience.short}</span>
							</h3>
							{#if dies}
								<p class="hint">Killed – earns nothing.</p>
							{:else}
								<div class="switches" role="group" aria-label="Whether {row.name} took part">
									<button class="switch-row" role="switch" aria-checked={row.tookPart} onclick={() => toggleTookPart(row)}>
										Took part<span class="track" aria-hidden="true"></span>
									</button>
								</div>
								{#if row.tookPart}
									<div class="counter">
										<span class="label" id="earned-{row.instanceId}">{experience.label} earned</span>
										<div class="stepper" role="group" aria-labelledby="earned-{row.instanceId}">
											<button
												class="segment"
												aria-label="Less {experience.label.toLowerCase()} for {row.name}"
												disabled={row.earned <= 0}
												onclick={() => (row.earned -= 1)}>−</button
											>
											<output class="figure">{row.earned}</output>
											<button class="segment" aria-label="More {experience.label.toLowerCase()} for {row.name}" onclick={() => (row.earned += 1)}>+</button>
										</div>
									</div>
								{/if}
								{#each besides as note (note)}
									<p class="hint">{note}</p>
								{/each}
								{#if line}
									<p class="hint">{line}</p>
								{/if}
							{/if}
						</section>
					{/each}
					{#if draft.excluded.length || sittingOut.length}
						<section>
							{#if draft.excluded.length}
								<p class="hint">Never earn {experience.label.toLowerCase()}: {draft.excluded.join(', ')}</p>
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
				{#if last}
					<button class="add" disabled={busy} onclick={apply} use:focusOnMount>Apply</button>
				{:else}
					<button class="add" onclick={() => step(1)} use:focusOnMount>Next</button>
				{/if}
			</div>
		{:else if current === 'recover' && injuries?.recover}
			{@const recover = injuries.recover}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">{recover.label}</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<p class="note">{recover.note}</p>
					</section>
					{#each healing as { instance, injuries: held } (instance.instanceId)}
						<section>
							<h3 class="heading"><span>{nameOf(instance.instanceId)}</span><span class="rule"></span></h3>
							<div class="switches" role="group" aria-label="Temporary injuries of {nameOf(instance.instanceId)}">
								{#each held as injury (injury)}
									{@const key = healKey(instance.instanceId, injury)}
									<button class="switch-row" role="switch" aria-checked={draft.healed.includes(key)} onclick={() => toggleHealed(key)}>
										{injuries.result(injury)?.name ?? injury} · {recover.heals}<span class="track" aria-hidden="true"></span>
									</button>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				{#if last}
					<button class="add" disabled={busy} onclick={apply} use:focusOnMount>Apply</button>
				{:else}
					<button class="add" onclick={() => step(1)} use:focusOnMount>Next</button>
				{/if}
			</div>
		{:else if current === 'seize' && holdings}
			{@const seize = draft.seize}
			{@const owned = warband.holdings ?? []}
			{#snippet table(picked: string | null, onpick: (id: string) => void, label: string)}
				<div class="results-table" role="group" aria-label={label}>
					{#each holdings!.table as holding (holding.id)}
						{@const open = picked === holding.id}
						<div class="unfold" class:open>
							<button class="unfold-head" aria-pressed={open} onclick={() => onpick(holding.id)}>
								<span class="roll">{holding.roll}</span>
								<span class="line">{holding.name}</span>
							</button>
							{#if open}
								<div class="unfold-detail">
									{#if holding.income}<p class="unfold-text">Income: {holding.income} silver.</p>{/if}
									{#if holding.ransack}<p class="unfold-text">Ransack: {holding.ransack} silver.</p>{/if}
									{#if holding.text}<p class="unfold-text">{holding.text}</p>{/if}
									{#each holding.rules as rule (rule.name)}
										<p class="unfold-text"><strong>{rule.name}:</strong> <RichText text={rule.text} /></p>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/snippet}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">{holdings.label}</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					{#if draft.result === 'win'}
						<section>
							<p class="note">Roll on the Holdings table for the prize holding and tap it. Then take it, seize one of your opponent's holdings instead, or stand your ground.</p>
							<p class="caption">Prize holding · {holdings.dice}</p>
							{@render table(seize.prize, pickPrize, 'Prize holding')}
							{#if seize.prize}
								<div class="toggles stacked" role="group" aria-label="What you take">
									{#each [{ take: 'prize', label: 'Seize the prize' }, { take: 'enemy', label: 'Seize an enemy holding' }, { take: 'stand', label: 'Stand ground' }] as option (option.take)}
										<button class="toggle" aria-pressed={seize.take === option.take} onclick={() => (seize.take = seize.take === option.take ? null : (option.take as 'prize' | 'enemy' | 'stand'))}>
											{option.label}
										</button>
									{/each}
								</div>
							{/if}
							{#if seize.take === 'enemy'}
								<p class="caption">Enemy holding seized</p>
								{@render table(seize.enemy, (id) => (seize.enemy = seize.enemy === id ? null : id), 'Enemy holding seized')}
							{/if}
						</section>
					{:else}
						<section>
							<p class="note">Where your opponent won, they may seize one of your holdings; where they did so, you may take the prize holding they rolled.</p>
							{#if owned.length}
								<p class="caption">Seized by your opponent</p>
								<div class="toggles stacked" role="group" aria-label="Seized by your opponent">
									{#each owned as id, i (i)}
										<button class="toggle" aria-pressed={seize.lost.includes(i)} onclick={() => (seize.lost = toggleIn(seize.lost, i))}>
											{holdingOf(game, id)?.name ?? id}
										</button>
									{/each}
								</div>
							{/if}
							<p class="caption">Prize holding taken · {holdings.dice}</p>
							{@render table(seize.prize, pickPrize, 'Prize holding taken')}
						</section>
					{/if}
					{#if after.over > 0 || seize.forfeit.length}
						<section>
							<p class="note">A warband controls {holdings.max} holdings at most besides its stronghold. Give up {after.over || seize.forfeit.length} to take the new one.</p>
							<div class="toggles stacked" role="group" aria-label="Given up">
								{#each owned as id, i (i)}
									{#if !seize.lost.includes(i)}
										<button class="toggle" aria-pressed={seize.forfeit.includes(i)} onclick={() => (seize.forfeit = toggleIn(seize.forfeit, i))}>
											Give up {holdingOf(game, id)?.name ?? id}
										</button>
									{/if}
								{/each}
							</div>
						</section>
					{/if}
					{#if levelUp}
						<section>
							<p class="note">This is the warband's battle that raises its stronghold to the {ordinal(levelUp)} level. Pick an upgrade for it.</p>
							<div class="results-table" role="group" aria-label="Stronghold upgrade">
								{#each holdings.upgrades(faction).filter((u) => !(warband.upgrades ?? []).includes(u.id)) as upgrade (upgrade.id)}
									{@const open = seize.upgrade === upgrade.id}
									<div class="unfold" class:open>
										<button class="unfold-head" aria-pressed={open} onclick={() => (seize.upgrade = open ? null : upgrade.id)}>
											<span class="line">{upgrade.name}</span>
										</button>
										{#if open}
											<div class="unfold-detail">
												{#each upgrade.rules as rule (rule.name)}
													<p class="unfold-text"><strong>{rule.name}:</strong> <RichText text={rule.text} /></p>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</section>
					{/if}
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				<button class="add" onclick={() => step(1)} use:focusOnMount>Next</button>
			</div>
		{:else if current === 'collect' && holdings}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">Income</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<p class="note">Roll each income at the table and enter what it comes to. A ransacked holding becomes a Ruined Hovel.</p>
					</section>
					{#each sources as source (source.key)}
						{@const silver = draft.collect.silver[source.key] ?? 0}
						{@const by = stepOf(source.roll)}
						<section>
							<div class="counter">
								<span class="label" id="silver-{source.key}">{source.label} · {source.roll}</span>
								<div class="stepper" role="group" aria-labelledby="silver-{source.key}">
									<button class="segment" aria-label="{by} silver less from {source.label}" disabled={silver <= 0} onclick={() => addSilver(source.key, -by)}>−</button>
									<output class="figure">{silver}</output>
									<button class="segment" aria-label="{by} silver more from {source.label}" onclick={() => addSilver(source.key, by)}>+</button>
								</div>
							</div>
							{#if source.holding && source.at !== undefined}
								{@const holding = source.holding}
								{@const place = source.at}
								{#if holding.turns}
									<div class="switches">
										<button class="switch-row" role="switch" aria-checked={draft.collect.turned.includes(place)} onclick={() => (draft.collect.turned = toggleIn(draft.collect.turned, place))}>
											{holding.turns.rule}: rolled {holding.turns.on} – {holding.turns.into ? `becomes ${holdingOf(game, holding.turns.into)?.name}` : 'removed'}<span class="track" aria-hidden="true"></span>
										</button>
									</div>
								{/if}
								{#if holding.table}
									<p class="caption" id="table-{place}">{holding.rules[0]?.name ?? holding.name} · D6</p>
									<div class="results" role="group" aria-labelledby="table-{place}">
										{#each holding.table as piece, n (n)}
											<button class="segment" aria-pressed={draft.collect.tabled[place] === n + 1} onclick={() => (draft.collect.tabled[place] = draft.collect.tabled[place] === n + 1 ? 0 : n + 1)}>{n + 1}</button>
										{/each}
									</div>
									{#if draft.collect.tabled[place]}
										{@const piece = holding.table[draft.collect.tabled[place] - 1]}
										<p class="hint">{piece ? `${wargearName(piece)} to the stash.` : 'Nothing extra.'}</p>
									{/if}
								{/if}
								{#each holding.gives ?? [] as give (give.wargear)}
									{#if typeof give.count === 'number'}
										<p class="hint">{give.count} {wargearName(give.wargear)} to the stash.</p>
									{:else}
										{@const key = `${place}:${give.wargear}`}
										{@const count = draft.collect.counts[key] ?? 0}
										<div class="counter">
											<span class="label" id="count-{key}">{wargearName(give.wargear)} · {give.count}</span>
											<div class="stepper" role="group" aria-labelledby="count-{key}">
												<button class="segment" aria-label="One {wargearName(give.wargear)} less" disabled={count <= 0} onclick={() => (draft.collect.counts[key] = count - 1)}>−</button>
												<output class="figure">{count}</output>
												<button class="segment" aria-label="One {wargearName(give.wargear)} more" onclick={() => (draft.collect.counts[key] = count + 1)}>+</button>
											</div>
										</div>
									{/if}
								{/each}
								{#if holding.finds}
									<p class="hint">Roll once on the Curiosities table and add what you find to the stash on the back of the warband card.</p>
								{/if}
							{/if}
						</section>
					{/each}
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				{#if last}
					<button class="add" disabled={busy} onclick={apply} use:focusOnMount>Apply</button>
				{:else}
					<button class="add" onclick={() => step(1)} use:focusOnMount>Next</button>
				{/if}
			</div>
		{:else if current === 'downtime' && holdings}
			{@const used = Object.keys(draft.collect.leeched).length}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">Downtime</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					{#if leech && leechable.length}
						<section>
							<h3 class="heading"><span>{leech.label}</span><span class="rule"></span></h3>
							<p class="note">{leech.note} {jars} {jars === 1 ? 'jar' : 'jars'} to use.</p>
							{#each leechable as fighter (fighter.instanceId)}
								{@const answer = draft.collect.leeched[fighter.instanceId]}
								<p class="caption" id="leech-{fighter.instanceId}">{nameOf(fighter.instanceId)} · {game.campaign?.fighter.find((c) => c.key === leech.counter)?.label ?? leech.counter} {fighter.tally?.[leech.counter]}</p>
								<div class="results" role="group" aria-labelledby="leech-{fighter.instanceId}">
									{#each [{ hit: false, label: '1–3' }, { hit: true, label: '4+' }] as option (option.label)}
										<button
											class="segment"
											aria-pressed={answer === option.hit}
											disabled={answer === undefined && used >= jars}
											onclick={() => {
												if (answer === option.hit) delete draft.collect.leeched[fighter.instanceId];
												else draft.collect.leeched[fighter.instanceId] = option.hit;
											}}>{option.label}</button
										>
									{/each}
								</div>
							{/each}
						</section>
					{/if}
					{#if upgradeGives.length}
						<section>
							<h3 class="heading"><span>Stronghold</span><span class="rule"></span></h3>
							<p class="note">Into the stash: {upgradeGives.join(', ')}.</p>
						</section>
					{/if}
				</div>
			</div>

			<div class="foot">
				<button class="plain" onclick={() => step(-1)}>Back</button>
				{#if last}
					<button class="add" disabled={busy} onclick={apply} use:focusOnMount>Apply</button>
				{:else}
					<button class="add" onclick={() => step(1)} use:focusOnMount>Next</button>
				{/if}
			</div>
		{:else if current === 'explore' && rules.explore}
			<div class="scroll">
				<h2 class="name" id="aftermath-title">{rules.explore.label}</h2>
				<p class="page-count">Aftermath · {at + 1} of {pages.length}</p>
				<div class="parchment">
					<section>
						<h3 class="heading"><span id="search-party">Search party</span><span class="rule"></span></h3>
						<p class="note">
							{#if rules.explore.party.slots}
								{rules.explore.party.slots.map((slot) => `${slot.min === slot.max ? slot.min : `${slot.min}–${slot.max}`} ${slot.label}`).join(', ')} who came through the battle.
							{:else}
								Up to {rules.explore.party.size} who came through the battle.
							{/if}
							Each rolls an exploration die.
						</p>
						<div class="toggles" role="group" aria-labelledby="search-party">
							{#each explorers as fighter (fighter.instanceId)}
								{@const reason = partyReason(fighter.instanceId, fighter.blocked, fighter.keywordIds)}
								<button
									class="toggle"
									aria-pressed={exploration?.party.includes(fighter.instanceId) ?? false}
									disabled={reason !== null}
									onclick={() => exploration && rules.explore && toggleParty(draft.explore, exploration.party, fighter.instanceId)}
								>
									{nameOf(fighter.instanceId)}{reason ? ` – ${reason}` : ''}
								</button>
							{/each}
						</div>
						{#if lacking.length}
							<p class="hint">The party still needs {lacking.join(' and ')}.</p>
						{/if}
						{#if exploration?.why}
							<p class="hint">{exploration.why}: {exploration.most} encounters may be resolved.</p>
						{/if}
						{#each exploration?.party.length ? rules.explore.aids(warband, exploration.party) : [] as aid (aid.text)}
							<p class="hint">{aid.text}</p>
							{#if aid.spend}
								{@const spend = aid.spend}
								<button
									class="switch-row"
									role="switch"
									aria-checked={draft.explore.spent.includes(spend)}
									onclick={() =>
										(draft.explore.spent = draft.explore.spent.includes(spend) ? draft.explore.spent.filter((id) => id !== spend) : [...draft.explore.spent, spend])}
								>
									{wargearName(spend)} used<span class="track" aria-hidden="true"></span>
								</button>
							{/if}
						{/each}
					</section>
					{#if exploration?.party.length}
						<section>
							<p class="note">What the exploration roll ran into. Roll at the table and tap it.</p>
							<div class="toggles stacked">
								<button
									class="toggle"
									aria-pressed={exploration.encounters.length === 0}
									onclick={() => pickEncounter(draft.explore, exploration.encounters, exploration.most, null)}>No encounter</button
								>
							</div>
						</section>
						{#each groups as group (group.name)}
							<section>
								<h3 class="heading"><span id="encounters-{group.name}">{group.name}</span><span class="rule"></span></h3>
								<div class="results-table" role="group" aria-labelledby="encounters-{group.name}">
									{#each group.encounters as e (e.roll)}
										{@const answer = exploration.encounters.find((a) => a.roll === e.roll)}
										{@const reason = encounterReason(e.roll)}
										<div class="unfold" class:open={!!answer}>
											<button
												class="unfold-head"
												aria-pressed={!!answer}
												disabled={reason !== null}
												onclick={() => pickEncounter(draft.explore, exploration.encounters, exploration.most, e.roll)}
											>
												<span class="roll">{e.roll}</span>
												<span class="line">{e.name}{e.mishap ? ' – mishap' : ''}{reason ? ` – ${reason}` : ''}</span>
											</button>
											{#if answer}
												{@const option = answer.option === null ? undefined : e.ask?.options[answer.option]}
												<div class="unfold-detail">
													<p class="unfold-text"><RichText text={e.text} /></p>
													{#if e.who}
														{@const pool = whoOf(e.who)}
														<p class="caption" id="who-{e.roll}">Fighter</p>
														{#if e.who.note}<p class="unfold-text">{e.who.note}</p>{/if}
														{#if pool.length}
															<div class="toggles" role="group" aria-labelledby="who-{e.roll}">
																{#each pool as id (id)}
																	<button class="toggle" aria-pressed={answer.fighter === id} onclick={() => pickFighter(answer, id)}>{nameOf(id)}</button>
																{/each}
															</div>
														{:else}
															<p class="unfold-text">Nobody here fits.</p>
														{/if}
														{#if needsFighter(rules.explore, answer) && !pool.includes(answer.fighter ?? '')}
															<p class="unfold-text">Pick the fighter it falls on.</p>
														{/if}
													{/if}
													{@render finds(answer, e.gains, 'e')}
													{#if e.ask}
														<p class="caption" id="ask-{e.roll}">{e.ask.label}</p>
														<div class="toggles stacked" role="group" aria-labelledby="ask-{e.roll}">
															{#each e.ask.options as o, i (i)}
																{@const cost = costOf(o.gains)}
																{@const gold = goldLeft(warband, game, faction, draft, '')}
																{@const short = cost > gold && answer.option !== i}
																<button class="toggle" aria-pressed={answer.option === i} disabled={short} onclick={() => pickOption(answer, i)}>
																	{o.label}{cost ? ` – ${cost} ${game.currency}` : ''}{short ? `, only ${Math.max(0, gold)} ${game.currency} left` : ''}
																</button>
															{/each}
														</div>
														{#if option}
															{@render finds(answer, option.gains, `o${answer.option}`)}
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
					{:else}
						<section>
							<p class="note">Nobody explores without a search party.</p>
						</section>
					{/if}
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
							{#each earned.found?.recruits ?? [] as recruit, i (i)}
								<li>
									<span class="line"
										><span class="gain">{faction.fighters.find((t) => t.id === recruit.fighterId)?.name ?? recruit.fighterId}</span> – {recruit.source}, joins the warband{recruit.free
											? ' for nothing'
											: ''}</span
									>
								</li>
							{/each}
							{#each earned.found?.fighters ?? [] as find, i (i)}
								<li><span class="line"><span class="gain">{nameOf(find.instanceId)}</span> – {find.source}: {fighterLine(find)}</span></li>
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
	/* A roll's outcome as one pill across the card, as the result is (`BattleResult`). */
	.results .segment {
		flex: 1;
	}

	/* A count the dice cannot reach any more fades as a stepper's sign does. */
	.results .segment:disabled {
		color: color-mix(in srgb, var(--card-green) 35%, transparent);
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
