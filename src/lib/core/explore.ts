/**
 * The search party's step of the aftermath: the encounter the exploration
 * roll found, tapped as rolled at the table, and what it brings – an answer
 * where it asks, a row of a loot table for each roll on one, a count where a
 * find is rolled for. Every answer is held by its path through the finds, so
 * a row tapped again, or another answer, drops what was answered under it.
 */

import type { Encounter, Explore, FindAmount, FindGain, FindTable } from './types';

export interface ExploreAnswer {
	/** The encounter by its roll; null for none. */
	encounter: string | null;
	/** The answer tapped where it asks, by its place; null while none is. */
	option: number | null;
	/** By path: the row of a loot table by its roll, or the unique piece by its wargear id. */
	picks: Record<string, string>;
	/** By path: what a rolled count came to. */
	amounts: Record<string, number>;
}

export const noEncounter = (): ExploreAnswer => ({ encounter: null, option: null, picks: {}, amounts: {} });

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

/** The encounter answered, or null for none. */
export function encounterOf(explore: Explore, answer: ExploreAnswer): Encounter | null {
	return explore.encounters.find((e) => e.roll === answer.encounter) ?? null;
}

/** The gains an answer brings, each with the path its own answers are held by. */
export function gainsOf(explore: Explore, answer: ExploreAnswer): { path: string; gains: FindGain[] }[] {
	const encounter = encounterOf(explore, answer);
	if (!encounter) return [];
	const option = answer.option === null ? undefined : encounter.ask?.options[answer.option];
	return [{ path: 'e', gains: encounter.gains }, ...(option ? [{ path: `o${answer.option}`, gains: option.gains }] : [])];
}

export const tableOf = (explore: Explore, id: string): FindTable | undefined => explore.tables.find((t) => t.id === id);

/** Drops every answer held under a path, for a row tapped again or another one tapped. */
function dropUnder(answer: ExploreAnswer, path: string) {
	for (const key of Object.keys(answer.picks)) if (key.startsWith(`${path}.`)) delete answer.picks[key];
	for (const key of Object.keys(answer.amounts)) if (key.startsWith(`${path}.`)) delete answer.amounts[key];
}

/** Taps an encounter: another drops every answer given; the one tapped again goes back to none. */
export function pickEncounter(answer: ExploreAnswer, roll: string | null) {
	Object.assign(answer, noEncounter(), { encounter: answer.encounter === roll ? null : roll });
}

/** Taps an answer to what the encounter asks; tapped again, it is taken back. */
export function pickOption(answer: ExploreAnswer, index: number) {
	if (answer.option !== null) dropUnder(answer, `o${answer.option}`);
	answer.option = answer.option === index ? null : index;
}

/** Taps a row of a loot table, or a unique piece, at a path; tapped again, it is taken back. */
export function pickAt(answer: ExploreAnswer, path: string, value: string) {
	dropUnder(answer, path);
	if (answer.picks[path] === value) delete answer.picks[path];
	else answer.picks[path] = value;
}

/** Taps what a rolled count came to; tapped again, it is taken back. */
export function amountAt(answer: ExploreAnswer, path: string, value: number) {
	if (answer.amounts[path] === value) delete answer.amounts[path];
	else answer.amounts[path] = value;
}

/** The unique pieces picked anywhere in the answer, so the same one is not found twice. */
export function uniquesPicked(explore: Explore, answer: ExploreAnswer): string[] {
	const picked: string[] = [];
	const walk = (gains: FindGain[], path: string) =>
		gains.forEach((gain, i) => {
			const at = pathOf(path, i);
			if ('unique' in gain && answer.picks[at]) picked.push(answer.picks[at]);
			const row = 'table' in gain ? tableOf(explore, gain.table)?.rows.find((r) => r.roll === answer.picks[at]) : undefined;
			if (row) walk(row.gains, at);
		});
	for (const { path, gains } of gainsOf(explore, answer)) walk(gains, path);
	return picked;
}

/**
 * What the answer brings: each fixed gain, each count as tapped, each loot
 * table by the row tapped and what that row brings in turn. A count or a row
 * not yet tapped brings nothing and is named among what is still to roll.
 * `name` gives a wargear id its name, `currency` the gold its unit.
 */
export function findsOf(explore: Explore, answer: ExploreAnswer, name: (id: string) => string, currency: string): Finds {
	const finds: Finds = { gold: 0, shards: 0, tally: {}, stash: [], lines: [], open: [] };
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
	return finds;
}
