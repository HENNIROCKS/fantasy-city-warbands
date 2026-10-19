/**
 * What the back of the warband card writes: gold added, pieces of the stash
 * sold or thrown away, battles added or struck and the colour, as the Wyrdcry
 * Warband Deck keeps them there, and the name, fluff, notes and campaign
 * counters, as the back of a fighter's card has them, and – to take back a
 * tap made by mistake – the searches since the battle and a warband marked
 * disbanded. The draft is held apart
 * from the warband until Done writes it in one go; Cancel lets it fall.
 *
 * `gold` is the whole purse – what the warband is worth together with what it
 * has left – so a piece leaving the stash takes its price out of the purse
 * along with the value, and the gold left stays where it was; a sale then adds
 * what the piece brings.
 */

import { findsOf } from './finds';
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
	/** Blank, or the faction's own name, for a warband not yet named. */
	name: string;
	fluff: string;
	notes: string;
	/** The deck's colour, null for the card green. */
	colour: string | null;
	/** The game's campaign counters for the warband, such as favour, by key. */
	tally: Record<string, number>;
	/** Sums of gold added, in order; Done writes their total. */
	goldAdded: number[];
	stashOut: StashOut[];
	/** The battles as the back shows them, those added on it included. */
	history: BattleRecord[];
	/** Battles struck, dropped on Done and brought back until then. */
	removed: string[];
	pending: PendingBattle;
	/** Whether the searches since the battle are cleared: every searcher free again, what was found and not bought gone. */
	clearSearches: boolean;
	/** Whether a warband marked disbanded is taken back to building. */
	undisband: boolean;
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
	const { fluff: _fluff, notes: _notes, disbanded, finds: _finds, ...rest } = warband;
	const finds = draft.clearSearches ? findsOf(warband) : null;
	const fluff = draft.fluff.trim();
	const notes = draft.notes.trim();
	const counted = Object.fromEntries(Object.entries(draft.tally).filter(([key, value]) => value !== 0 || warband.tally?.[key] !== undefined));
	return {
		...rest,
		name: draft.name.trim(),
		...(fluff ? { fluff } : {}),
		...(notes ? { notes } : {}),
		...(draft.colour || warband.colour !== undefined ? { colour: draft.colour } : {}),
		...(Object.keys(counted).length || warband.tally ? { tally: counted } : {}),
		...(changed ? { gold: purse(warband, game) + goldIn(stash, draft, faction, game) - removed } : {}),
		...(gone.size ? { stash: stash.filter((_, i) => !gone.has(i)) } : {}),
		...(history.length || warband.history ? { history } : {}),
		...(finds
			? { finds: { after: finds.after, searched: [], found: finds.found.filter((f) => f.bought).map((f) => ({ ...f, copies: f.bought! })) } }
			: warband.finds
				? { finds: warband.finds }
				: {}),
		...(disbanded && !draft.undisband ? { disbanded } : {})
	};
}
