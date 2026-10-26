/**
 * The search party's step of the aftermath: who goes, the encounters the
 * exploration roll found, tapped as rolled at the table – one, or more where
 * a rule allows it – and what each brings: an answer where it asks, a row of a
 * loot table for each roll on one, a count where a find is rolled for. Every
 * answer is held by its path through the finds, so a row tapped again, or
 * another answer, drops what was answered under it.
 */

import type { Encounter, Explore, FindAmount, FindGain, FindTable } from './types';

/** One encounter and what was answered under it. */
export interface EncounterAnswer {
	/** The encounter by its roll. */
	roll: string;
	/** The answer tapped where it asks, by its place; null while none is. */
	option: number | null;
	/** By path: the row of a loot table by its roll, or the unique piece by its wargear id. */
	picks: Record<string, string>;
	/** By path: what a rolled count came to. */
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

/** Why a fighter cannot join the search party, in a few words; null where it can. */
export function partyBlocked(explore: Explore, fighter: PartyCandidate): string | null {
	if (!fighter.tookPart) return 'Sat it out';
	if (fighter.out) return 'Out of action';
	const barred = explore.party.excluded.find((k) => fighter.keywordIds.includes(k));
	return barred ? barred.toUpperCase() : null;
}

/** The search party as it stands: as tapped, or the first of those who may go, and never one the battle now keeps back. */
export function partyOf(explore: Explore, answer: ExploreAnswer, fighters: PartyCandidate[]): string[] {
	const may = fighters.filter((f) => partyBlocked(explore, f) === null).map((f) => f.instanceId);
	return answer.party ? answer.party.filter((id) => may.includes(id)) : may.slice(0, explore.party.size);
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
}

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
	const fresh = (r: string): EncounterAnswer => ({ roll: r, option: null, picks: {}, amounts: {} });
	if (roll === null) answer.encounters = [];
	else if (standing.some((e) => e.roll === roll)) answer.encounters = standing.filter((e) => e.roll !== roll);
	else if (most <= 1) answer.encounters = [fresh(roll)];
	else if (standing.length < most) answer.encounters = [...standing, fresh(roll)];
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
 * `name` gives a wargear id its name, `currency` the gold its unit.
 */
export function findsOf(explore: Explore, encounters: EncounterAnswer[], name: (id: string) => string, currency: string): Finds {
	const finds: Finds = { gold: 0, shards: 0, tally: {}, stash: [], lines: [], open: [] };
	for (const answer of encounters) {
		const count = (amount: FindAmount, at: string, what: string): number | null => {
			if (typeof amount === 'number') return amount;
			const value = answer.amounts[at];
			if (value === undefined) finds.open.push(`${what} – roll ${amount.roll}`);
			return value ?? null;
		};
		const walk = (gains: FindGain[], path: string, source: string) =>
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
					if (row) walk(row.gains, at, row.name);
					else if (table) finds.open.push(`${source}: ${table.name} – roll ${table.dice}`);
				} else if ('unique' in gain) {
					const id = answer.picks[at];
					if (id) {
						finds.stash.push(id);
						finds.lines.push({ gain: name(id), why: `– ${source}, to the stash` });
					} else finds.open.push(`${source} – roll ${gain.unique.roll}`);
				}
			});
		const encounter = encounterOf(explore, answer);
		for (const { path, gains } of gainsOf(explore, answer)) walk(gains, path, encounter?.name ?? '');
		if (encounter?.ask && answer.option === null) finds.open.push(`${encounter.name} – ${encounter.ask.label.toLowerCase()}`);
	}
	return finds;
}
