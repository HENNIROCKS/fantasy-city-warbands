/**
 * What the back of the warband card writes, as the Wyrdcry Warband Deck keeps
 * it there: gold added, pieces of the stash sold or thrown away, and battles
 * added or struck. The draft is held apart from the warband until Done writes
 * it in one go; Cancel lets it fall.
 *
 * `gold` is the whole purse – what the warband is worth together with what it
 * has left – so a piece leaving the stash takes its price out of the purse
 * along with the value, and the gold left stays where it was; a sale then adds
 * what the piece brings.
 */

import type { BattleRecord, Faction, GameSystem, Warband } from './types';
import { purse } from './validate';
import { newId } from './warband';

export interface StashOut {
	/** The piece's place in the stash as stored, which nothing moves until Done. */
	index: number;
	/** Sold for `saleOf()`; otherwise thrown away for nothing. */
	sold: boolean;
}

/** The battle being entered and not yet added. */
export interface PendingBattle {
	date: string;
	result: BattleRecord['result'] | null;
	opponentWarband: string;
	opponentPlayer: string;
}

export interface WarbandBackDraft {
	/** Sums of gold added, in order; Done writes their total. */
	goldAdded: number[];
	stashOut: StashOut[];
	/** The battles as the back shows them, those added on it included. */
	history: BattleRecord[];
	/** Battles struck, dropped on Done and brought back until then. */
	removed: string[];
	pending: PendingBattle;
}

export function emptyPending(date: string): PendingBattle {
	return { date, result: null, opponentWarband: '', opponentPlayer: '' };
}

/** A piece's price as the warband's value counts it. */
export function priceOf(id: string, faction: Faction): number {
	return faction.wargear.find((w) => w.id === id)?.cost ?? 0;
}

/** What a piece would sell for, or 0 where the game sells nothing back or the piece has no price. */
export function saleOf(id: string, faction: Faction, game: GameSystem): number {
	const cost = priceOf(id, faction);
	return cost > 0 && game.salePrice ? game.salePrice(cost) : 0;
}

/** What the draft brings into the gold left: what is added, and what is sold. */
export function goldIn(stash: string[], draft: WarbandBackDraft, faction: Faction, game: GameSystem): number {
	const added = draft.goldAdded.reduce((sum, amount) => sum + amount, 0);
	const sold = draft.stashOut.reduce((sum, { index, sold }) => sum + (sold ? saleOf(stash[index] ?? '', faction, game) : 0), 0);
	return added + sold;
}

export function toRecord(pending: PendingBattle): BattleRecord | null {
	if (!pending.result || !pending.date) return null;
	return {
		id: newId(),
		date: pending.date,
		result: pending.result,
		opponentWarband: pending.opponentWarband.trim(),
		opponentPlayer: pending.opponentPlayer.trim()
	};
}

/**
 * The warband as Done writes it. A battle left filled in but not added is
 * taken in as well – its result is picked, so it was meant, and Done is not
 * the place to lose it.
 */
export function applyBack(warband: Warband, game: GameSystem, faction: Faction, draft: WarbandBackDraft): Warband {
	const stash = warband.stash ?? [];
	const gone = new Set(draft.stashOut.map((out) => out.index));
	const removed = draft.stashOut.reduce((sum, { index }) => sum + priceOf(stash[index] ?? '', faction), 0);
	const pending = toRecord(draft.pending);
	const history = [...draft.history.filter((r) => !draft.removed.includes(r.id)), ...(pending ? [pending] : [])];
	const changed = draft.goldAdded.length > 0 || gone.size > 0;
	return {
		...warband,
		...(changed ? { gold: purse(warband, game) + goldIn(stash, draft, faction, game) - removed } : {}),
		...(gone.size ? { stash: stash.filter((_, i) => !gone.has(i)) } : {}),
		...(history.length || warband.history ? { history } : {})
	};
}
