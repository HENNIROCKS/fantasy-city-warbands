/**
 * The search party's step of the aftermath: who goes, the encounters the
 * exploration roll found, tapped as rolled at the table – one, or more where
 * a rule allows it – and what each brings: an answer where it asks, a row of a
 * loot table for each roll on one, a count where a find is rolled for. Every
 * answer is held by its path through the finds, so a row tapped again, or
 * another answer, drops what was answered under it.
 */

import type { Encounter, Explore, FindAmount, FindGain, FindTable, NextBattle, PartyGain } from './types';

/** One encounter and what was answered under it. */
export interface EncounterAnswer {
	/** The encounter by its roll. */
	roll: string;
	/** The answer tapped where it asks, by its place; null while none is. */
	option: number | null;
	/** The fighter it falls on, by instance id, where it picks one; null while none is. */
	fighter: string | null;
	/** By path: the row of a loot table by its roll, the unique piece by its wargear id, or the [injury] result taken away by its id. */
	picks: Record<string, string>;
	/** By path: what a rolled count came to; for a roll that counts its dice, by path and `#` the result's place. */
	amounts: Record<string, number>;
}

export interface ExploreAnswer {
	/** Who goes, by instance id, as tapped; null until one is tapped, for the first of those who may. */
	party: string[] | null;
	/** The encounters, in the order tapped. */
	encounters: EncounterAnswer[];
	/** Pieces from the stash used on the exploration roll and given up, such as an Ornate Key, by wargear id. */
	spent: string[];
}

export const noExploration = (): ExploreAnswer => ({ party: null, encounters: [], spent: [] });

/** A fighter as the search party is picked from: who it is, and whether the battle lets it go. */
export interface PartyCandidate {
	instanceId: string;
	keywordIds: string[];
	tookPart: boolean;
	out: boolean;
}

/** The place of the party's `slots` a fighter fills: the first whose keywords it carries; null where it fills none or the game has none. */
export function slotOf(explore: Explore, keywordIds: string[]): number | null {
	const at = (explore.party.slots ?? []).findIndex((s) => s.keywords.some((k) => keywordIds.includes(k)));
	return at < 0 ? null : at;
}

/** Why a fighter cannot join the search party, in a few words; null where it can. */
export function partyBlocked(explore: Explore, fighter: PartyCandidate): string | null {
	if (!fighter.tookPart) return 'Sat it out';
	if (fighter.out) return 'Out of action';
	const barred = explore.party.excluded.find((k) => fighter.keywordIds.includes(k));
	if (barred) return barred.toUpperCase();
	return explore.party.slots && slotOf(explore, fighter.keywordIds) === null ? 'Cannot go' : null;
}

/** Why one more fighter cannot join the party as it is, such as `3 Henchmen at most`; null where there is room. Slots count by the keywords the party's fighters carry. */
export function partyFull(explore: Explore, party: string[], keywordsOf: (id: string) => string[], keywordIds: string[]): string | null {
	if (party.length >= explore.party.size) return `${explore.party.size} at most`;
	const at = slotOf(explore, keywordIds);
	const slot = at === null ? undefined : explore.party.slots![at];
	if (!slot) return null;
	return party.filter((id) => slotOf(explore, keywordsOf(id)) === at).length >= slot.max ? `${slot.max} ${slot.label} at most` : null;
}

/** What the party still lacks of its slots, a line each: `1 Leader or Champion`; none where it is complete or the game has no slots. */
export function partyLacks(explore: Explore, party: string[], keywordsOf: (id: string) => string[]): string[] {
	return (explore.party.slots ?? []).flatMap((slot, at) => {
		const lacking = slot.min - party.filter((id) => slotOf(explore, keywordsOf(id)) === at).length;
		return lacking > 0 ? [`${lacking} ${lacking === 1 ? (slot.single ?? slot.label) : slot.label}`] : [];
	});
}

/** The search party as it stands: as tapped, or the first of those who may go, and never one the battle now keeps back. */
export function partyOf(explore: Explore, answer: ExploreAnswer, fighters: PartyCandidate[]): string[] {
	const may = fighters.filter((f) => partyBlocked(explore, f) === null);
	if (answer.party) return answer.party.filter((id) => may.some((f) => f.instanceId === id));
	const party: PartyCandidate[] = [];
	for (const f of may) {
		if (party.length >= explore.party.size) break;
		const at = slotOf(explore, f.keywordIds);
		const slot = at === null ? undefined : explore.party.slots![at];
		if (slot && party.filter((p) => slotOf(explore, p.keywordIds) === at).length >= slot.max) continue;
		party.push(f);
	}
	return party.map((f) => f.instanceId);
}

/** Taps a fighter in or out of the search party. */
export function toggleParty(answer: ExploreAnswer, party: string[], instanceId: string) {
	answer.party = party.includes(instanceId) ? party.filter((id) => id !== instanceId) : [...party, instanceId];
}

/** The encounters that stand: none without a party, and no more than it may resolve – the ones tapped last drop first. */
export function encountersOf(answer: ExploreAnswer, party: string[], most: number): EncounterAnswer[] {
	return party.length ? answer.encounters.slice(0, most) : [];
}

/** What the finds come to, as answered so far. */
export interface Finds {
	gold: number;
	shards: number;
	/** The game's campaign counters, such as favour, by key. */
	tally: Record<string, number>;
	/** Wargear ids into the stash, a copy each. */
	stash: string[];
	/** A line for each find, as the income page lists them. */
	lines: { gain: string; why: string }[];
	/** What is still to be rolled, a line each: `Lesser Loot Table – roll 2D6`. */
	open: string[];
	/** What falls on a fighter, by encounter: the one it picked, and each of the party it asks. */
	fighters: FighterFind[];
	/** Holdings the warband may take control of, by id on the game's table. */
	holdings: string[];
	/** Fighters joining the warband, by the type picked. */
	recruits: { fighterId: string; free: boolean; set: Record<string, number>; source: string }[];
	/** What the next battle brings. */
	next: NextBattle[];
}

/** Where the fighter type a `recruit` gain adds is picked, under the gain's path. */
export const recruitPath = (at: string) => `${at}:recruit`;

/** What an encounter does to the fighter it picked. */
export interface FighterFind {
	instanceId: string;
	/** The encounter's name. */
	source: string;
	levels: number;
	/** Results of the injury table it keeps, by id. */
	injuries: string[];
	/** [injury] results taken away, by id. */
	heal: string[];
	remove: boolean;
	stats: { key: string; bonus: number }[];
	/** Campaign counters it adds to, such as Black Rot or experience; below 0, takes from. */
	counters: { key: string; amount: number }[];
	/** A roll on the injury table it makes, with the results read as others; null where it makes none. */
	roll: { treat: Record<string, string> } | null;
}

/** A fixed gain as many times over as the dice that show it, such as a shard for each 4+. */
function timesOf(gain: FindGain, count: number): FindGain {
	if ('shards' in gain && typeof gain.shards === 'number') return { shards: gain.shards * count };
	if ('gold' in gain && typeof gain.gold === 'number') return { gold: gain.gold * count };
	if ('stat' in gain) return { stat: { ...gain.stat, bonus: gain.stat.bonus * count } };
	if ('counter' in gain) return { counter: { ...gain.counter, amount: gain.counter.amount * count } };
	return gain;
}

/** Whether a gain falls on the fighter the encounter picks. */
export const onFighter = (gain: FindGain) =>
	'injuryRoll' in gain || 'levels' in gain || 'injury' in gain || 'heal' in gain || 'remove' in gain || 'stat' in gain || 'counter' in gain || 'each' in gain;

/** Whether a fighter with these keywords is one the party gain falls on. */
export const partyMatches = (party: PartyGain, keywordIds: string[]) =>
	(!party.keywords || party.keywords.some((k) => keywordIds.includes(k))) && !(party.except ?? []).some((k) => keywordIds.includes(k));

/** Whether anything falls on the fighter. */
export const hasEffect = (find: FighterFind) =>
	!!(find.roll || find.levels || find.injuries.length || find.heal.length || find.remove || find.stats.length || find.counters.length);

/** Where the result tapped for one fighter of the party under a party gain is held. */
export const partyPath = (at: string, instanceId: string) => `${at}@${instanceId}`;

/** Where a gain sits under a given one. */
export const pathOf = (parent: string, index: number) => `${parent}.${index}`;

export const encounterOf = (explore: Explore, answer: EncounterAnswer): Encounter | undefined => explore.encounters.find((e) => e.roll === answer.roll);

/** The gains an answer brings, each with the path its own answers are held by. */
export function gainsOf(explore: Explore, answer: EncounterAnswer): { path: string; gains: FindGain[] }[] {
	const encounter = encounterOf(explore, answer);
	if (!encounter) return [];
	const option = answer.option === null ? undefined : encounter.ask?.options[answer.option];
	return [{ path: 'e', gains: encounter.gains }, ...(option ? [{ path: `o${answer.option}`, gains: option.gains }] : [])];
}

export const tableOf = (explore: Explore, id: string): FindTable | undefined => explore.tables.find((t) => t.id === id);

/** Drops every answer held under a path, for a row tapped again or another one tapped. */
function dropUnder(answer: EncounterAnswer, path: string) {
	for (const key of Object.keys(answer.picks)) if (key.startsWith(`${path}.`)) delete answer.picks[key];
	for (const key of Object.keys(answer.amounts)) if (key.startsWith(`${path}.`)) delete answer.amounts[key];
}

/**
 * Taps an encounter among those that stand: tapped again, it goes with what
 * was answered under it; where one only may be resolved, another takes its
 * place; where more may, it is added while there is room. Null clears them all.
 */
export function pickEncounter(answer: ExploreAnswer, standing: EncounterAnswer[], most: number, roll: string | null) {
	const fresh = (r: string): EncounterAnswer => ({ roll: r, option: null, fighter: null, picks: {}, amounts: {} });
	if (roll === null) answer.encounters = [];
	else if (standing.some((e) => e.roll === roll)) answer.encounters = standing.filter((e) => e.roll !== roll);
	else if (most <= 1) answer.encounters = [fresh(roll)];
	else if (standing.length < most) answer.encounters = [...standing, fresh(roll)];
}

/** Whether what is answered under the encounter asks for a fighter to fall on. */
export function needsFighter(explore: Explore, answer: EncounterAnswer): boolean {
	return gainsOf(explore, answer).some(({ gains }) => gains.some(onFighter));
}

/** Taps the fighter the encounter falls on; tapped again, it is taken back, and with it an [injury] picked to take away. */
export function pickFighter(answer: EncounterAnswer, instanceId: string) {
	answer.fighter = answer.fighter === instanceId ? null : instanceId;
	for (const key of Object.keys(answer.picks)) if (key.endsWith(':heal')) delete answer.picks[key];
}

/** Taps an answer to what the encounter asks; tapped again, it is taken back. */
export function pickOption(answer: EncounterAnswer, index: number) {
	if (answer.option !== null) dropUnder(answer, `o${answer.option}`);
	answer.option = answer.option === index ? null : index;
}

/** Taps a row of a loot table, or a unique piece, at a path; tapped again, it is taken back. */
export function pickAt(answer: EncounterAnswer, path: string, value: string) {
	dropUnder(answer, path);
	if (answer.picks[path] === value) delete answer.picks[path];
	else answer.picks[path] = value;
}

/** Taps what a rolled count came to; tapped again, it is taken back. */
export function amountAt(answer: EncounterAnswer, path: string, value: number) {
	if (answer.amounts[path] === value) delete answer.amounts[path];
	else answer.amounts[path] = value;
}

/** The unique pieces picked under the encounters, so the same one is not found twice. */
export function uniquesPicked(explore: Explore, encounters: EncounterAnswer[]): string[] {
	const picked: string[] = [];
	for (const answer of encounters) {
		const walk = (gains: FindGain[], path: string) =>
			gains.forEach((gain, i) => {
				const at = pathOf(path, i);
				if ('unique' in gain && answer.picks[at]) picked.push(answer.picks[at]);
				const row = 'table' in gain ? tableOf(explore, gain.table)?.rows.find((r) => r.roll === answer.picks[at]) : undefined;
				if (row) walk(row.gains, at);
			});
		for (const { path, gains } of gainsOf(explore, answer)) walk(gains, path);
	}
	return picked;
}

/**
 * What the encounters bring: each fixed gain, each count as tapped, each loot
 * table by the row tapped and what that row brings in turn. A count or a row
 * not yet tapped brings nothing and is named among what is still to roll.
 * `name` gives a wargear id its name, `currency` the gold its unit. A fighter
 * picked from the search party that has left it is picked no more. A party
 * gain falls on each fighter of the party it names – by `keywordsOf` – by the
 * result tapped for it; what falls on one fighter is one entry of `fighters`.
 */
export function findsOf(
	explore: Explore,
	encounters: EncounterAnswer[],
	party: string[],
	name: (id: string) => string,
	currency: string,
	keywordsOf: (id: string) => string[] = () => []
): Finds {
	const finds: Finds = { gold: 0, shards: 0, tally: {}, stash: [], lines: [], open: [], fighters: [], holdings: [], recruits: [], next: [] };
	for (const answer of encounters) {
		const encounter = encounterOf(explore, answer);
		const source = encounter?.name ?? '';
		const picked = answer.fighter && !(encounter?.who?.from === 'party' && !party.includes(answer.fighter)) ? answer.fighter : null;
		const falls = new Map<string, FighterFind>();
		const fallsOn = (instanceId: string): FighterFind => {
			if (!falls.has(instanceId)) falls.set(instanceId, { instanceId, source, levels: 0, injuries: [], heal: [], remove: false, stats: [], counters: [], roll: null });
			return falls.get(instanceId)!;
		};
		const on: FighterFind | null = picked ? fallsOn(picked) : null;
		if (needsFighter(explore, answer) && !on) finds.open.push(`${source} – pick the fighter`);
		const count = (amount: FindAmount, at: string, what: string): number | null => {
			if (typeof amount === 'number') return amount;
			const value = answer.amounts[at];
			if (value === undefined) finds.open.push(`${what} – roll ${amount.roll}`);
			return value ?? null;
		};
		const walk = (gains: FindGain[], path: string, source: string, on: FighterFind | null) =>
			gains.forEach((gain, i) => {
				const at = pathOf(path, i);
				if ('gold' in gain) {
					const gold = count(gain.gold, at, source);
					if (gold !== null) {
						finds.gold += gold;
						finds.lines.push({ gain: `${gold < 0 ? '−' : '+'}${Math.abs(gold)} ${currency}`, why: `– ${source}` });
					}
				} else if ('shards' in gain) {
					const shards = count(gain.shards, at, source);
					if (shards !== null) {
						finds.shards += shards;
						finds.lines.push({ gain: `+${shards} ${shards === 1 ? 'shard' : 'shards'}`, why: `– ${source}, delivered with the battle's` });
					}
				} else if ('tally' in gain) {
					finds.tally[gain.tally] = (finds.tally[gain.tally] ?? 0) + gain.amount;
					finds.lines.push({ gain: `+${gain.amount} ${gain.tally}`, why: `– ${source}` });
				} else if ('wargear' in gain) {
					const piece = name(gain.wargear);
					const copies = count(gain.copies ?? 1, at, piece === source ? source : `${source}, ${piece}`);
					if (copies !== null && copies > 0) {
						finds.stash.push(...Array.from({ length: copies }, () => gain.wargear));
						finds.lines.push({ gain: copies > 1 ? `${copies} × ${piece}` : piece, why: `– ${source}, to the stash` });
					}
				} else if ('table' in gain) {
					const table = tableOf(explore, gain.table);
					const row = table?.rows.find((r) => r.roll === answer.picks[at]);
					if (row) walk(row.gains, at, row.name, on);
					else if (table) finds.open.push(`${source}: ${table.name} – roll ${table.dice}`);
				} else if ('unique' in gain) {
					const id = answer.picks[at];
					if (id) {
						finds.stash.push(id);
						finds.lines.push({ gain: name(id), why: `– ${source}, to the stash` });
					} else finds.open.push(`${source} – roll ${gain.unique.roll}`);
				} else if ('recruit' in gain) {
					const fighterId = answer.picks[recruitPath(at)];
					if (fighterId) finds.recruits.push({ fighterId, free: !!gain.recruit.free, set: gain.recruit.set ?? {}, source });
					else finds.open.push(`${source} – pick the fighter who joins`);
				} else if ('holding' in gain) {
					const id = answer.picks[at];
					if (id) {
						finds.holdings.push(id);
						finds.lines.push({ gain: 'A holding', why: `– ${source}, taken` });
					}
				} else if ('party' in gain) {
					let rolled = true;
					for (const id of party.filter((p) => partyMatches(gain.party, keywordsOf(p)))) {
						const key = partyPath(at, id);
						const result = gain.party.dice === null ? gain.party.results[0] : gain.party.results.find((r) => r.on === answer.picks[key]);
						if (result) walk(result.gains, key, source, fallsOn(id));
						else rolled = false;
					}
					if (!rolled) finds.open.push(`${source} – roll ${gain.party.dice} for each fighter`);
				} else if ('next' in gain) {
					finds.next.push({ ...gain.next, source });
					finds.lines.push({ gain: gain.next.explore ? 'Next exploration' : 'Next battle', why: `– ${source}: ${gain.next.text}` });
				} else if (on) {
					if ('injuryRoll' in gain) on.roll = { treat: gain.injuryRoll.treat ?? {} };
					else if ('levels' in gain) on.levels += gain.levels;
					else if ('injury' in gain) on.injuries.push(gain.injury);
					else if ('remove' in gain) on.remove = true;
					else if ('stat' in gain) on.stats.push(gain.stat);
					else if ('counter' in gain) on.counters.push(gain.counter);
					else if ('heal' in gain) {
						const id = answer.picks[`${at}:heal`];
						if (id) on.heal.push(id);
						else finds.open.push(`${source} – pick the injury taken away`);
					} else if ('each' in gain) {
						const counts = gain.each.results.map((_, n) => answer.amounts[`${at}#${n}`]);
						if (counts.every((c) => c === undefined)) finds.open.push(`${source} – count the dice`);
						gain.each.results.forEach((r, n) => {
							const c = counts[n] ?? 0;
							if (c) walk(r.gains.map((g) => timesOf(g, c)), `${at}#${n}`, source, on);
						});
					}
				}
			});
		for (const { path, gains } of gainsOf(explore, answer)) walk(gains, path, source, on);
		if (encounter?.ask && answer.option === null) finds.open.push(`${encounter.name} – ${encounter.ask.label.toLowerCase()}`);
		for (const hit of falls.values()) if (hasEffect(hit)) finds.fighters.push(hit);
	}
	return finds;
}
