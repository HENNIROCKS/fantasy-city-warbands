/**
 * A warband as a file of its own. There is no sync: an export is a deliberate
 * act, and the file is the copy that survives the browser's storage.
 *
 * The warband sits inside an envelope that says what it is and in which shape,
 * so an import can tell this app's files from the Warband Deck's and the
 * Warband Builder's, and an older shape of its own from the current one. The
 * battle running on this device is not part of it.
 *
 * The warband's `updatedAt` travels inside it, so an import can say which of
 * two states is newer.
 */

import type { Advance, AwayReason, BattleRecord, FighterInstance, Finds, Warband } from './types';
import { sameWarband } from './warband';

export const FORMAT = 'fantasy-city-warbands';
/**
 * Raised whenever the shape of `warband` changes in a way an import has to know
 * about. 2 brought the campaign; a file of 1 reads as a warband without one.
 * 3 brought a fighter's injuries and why it sits out, which an app reading 2
 * would drop without a word.
 */
export const VERSION = 3;

export interface WarbandFile {
	format: typeof FORMAT;
	version: number;
	exportedAt: string;
	warband: Warband;
}

export function toFile(warband: Warband, now = new Date()): WarbandFile {
	return { format: FORMAT, version: VERSION, exportedAt: now.toISOString(), warband };
}

/**
 * Dated, so an export made before deleting does not replace an older copy of
 * the same warband in the same folder.
 */
export function fileName(name: string, now = new Date()): string {
	return `${name} – ${now.toISOString().slice(0, 10)}.json`;
}

/**
 * What reading a file came to: a warband to offer, with what was carried over
 * differently where the file is another app's, or why there is none.
 */
export type ReadResult = { ok: true; warband: Warband; hints?: string[] } | { ok: false; message: string };

/** Answers whether the app knows a game and a faction, by name for the message where it does not. */
export interface Known {
	game(id: string): string | null;
	faction(game: string, id: string): string | null;
	/**
	 * Reads a file of another app the games here know, such as the Warband Deck's;
	 * null where the file is none of them.
	 */
	other?(parsed: Record<string, unknown>): ReadResult | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isTally = (v: unknown): v is Record<string, number> => isObject(v) && Object.values(v).every(isNumber);

function readAdvance(raw: unknown): Advance | null {
	if (!isObject(raw)) return null;
	const { level, stat, bonus, rule, option } = raw;
	if (!isNumber(level)) return null;
	if (bonus !== undefined && !isNumber(bonus)) return null;
	for (const text of [stat, rule, option]) if (text !== undefined && typeof text !== 'string') return null;
	return {
		level,
		...(stat !== undefined ? { stat: stat as string } : {}),
		...(bonus !== undefined ? { bonus } : {}),
		...(rule !== undefined ? { rule: rule as string } : {}),
		...(option !== undefined ? { option: option as string } : {})
	};
}

const RESULTS: BattleRecord['result'][] = ['win', 'draw', 'loss'];
const AWAY: AwayReason[] = ['miss-next-battle', 'captured', 'dead'];

function readRecord(raw: unknown): BattleRecord | null {
	if (!isObject(raw)) return null;
	const { id, date, result, opponentWarband, opponentPlayer } = raw;
	if (!isStrings([id, date, opponentWarband, opponentPlayer])) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date as string)) return null;
	if (!RESULTS.includes(result as BattleRecord['result'])) return null;
	return {
		id: id as string,
		date: date as string,
		result: result as BattleRecord['result'],
		opponentWarband: opponentWarband as string,
		opponentPlayer: opponentPlayer as string
	};
}

/** Every entry read, or null where any one of them is not what it should be. */
function readFinds(raw: unknown): Finds | null {
	if (!isObject(raw)) return null;
	const { after, searched, found } = raw;
	if (typeof after !== 'string' || !isStrings(searched)) return null;
	const read = readAll(found, (entry) => {
		if (!isObject(entry)) return null;
		const { id, copies, bought } = entry;
		if (typeof id !== 'string' || !isNumber(copies) || (bought !== undefined && !isNumber(bought))) return null;
		return { id, copies, ...(bought !== undefined ? { bought } : {}) };
	});
	return read && { after, searched, found: read };
}

function readAll<T>(raw: unknown, read: (entry: unknown) => T | null): T[] | null {
	if (!Array.isArray(raw)) return null;
	const all = raw.map(read);
	return all.some((entry) => entry === null) ? null : (all as T[]);
}

function readFighter(raw: unknown): FighterInstance | null {
	if (!isObject(raw)) return null;
	const { instanceId, fighterId, name, wargear, picks, fluff, notes, xp, advances, injuries, away, leader, tally } = raw;
	if (typeof instanceId !== 'string' || typeof fighterId !== 'string' || typeof name !== 'string' || !isStrings(wargear)) return null;
	if (picks !== undefined && !isStrings(picks)) return null;
	if (injuries !== undefined && !isStrings(injuries)) return null;
	if (away !== undefined && !AWAY.includes(away as AwayReason)) return null;
	if (leader !== undefined && leader !== true) return null;
	for (const text of [fluff, notes]) if (text !== undefined && typeof text !== 'string') return null;
	if (xp !== undefined && !isNumber(xp)) return null;
	if (tally !== undefined && !isTally(tally)) return null;
	const spent = advances === undefined ? undefined : readAll(advances, readAdvance);
	if (spent === null) return null;
	return {
		instanceId,
		fighterId,
		name,
		wargear,
		...(picks ? { picks } : {}),
		...(fluff !== undefined ? { fluff: fluff as string } : {}),
		...(notes !== undefined ? { notes: notes as string } : {}),
		...(xp !== undefined ? { xp } : {}),
		...(spent !== undefined ? { advances: spent } : {}),
		...(injuries !== undefined ? { injuries } : {}),
		...(away !== undefined ? { away: away as AwayReason } : {}),
		...(leader === true ? { leader: true as const } : {}),
		...(tally !== undefined ? { tally } : {})
	};
}

/**
 * Only the fields the app knows, so nothing a file brings along ends up
 * stored – except under `tally`, which keeps every counter it holds: what the
 * game does not declare, nothing reads. A fighter type or a piece of wargear the faction lacks is let
 * through: the cards name it as unknown, as they do for a stored warband.
 */
function readWarband(raw: unknown): Warband | null {
	if (!isObject(raw)) return null;
	const { id, game, factionId, name, picks, fighters, colour, fluff, notes, updatedAt, gold, stash, history, finds, tally } = raw;
	if (typeof id !== 'string' || typeof game !== 'string' || typeof factionId !== 'string' || typeof name !== 'string') return null;
	if (!isObject(picks) || !Object.values(picks).every(isStrings) || !Array.isArray(fighters)) return null;
	const read = fighters.map(readFighter);
	if (read.some((f) => f === null)) return null;
	if (colour !== undefined && colour !== null && typeof colour !== 'string') return null;
	for (const text of [fluff, notes, updatedAt]) if (text !== undefined && typeof text !== 'string') return null;
	if (gold !== undefined && !isNumber(gold)) return null;
	if (stash !== undefined && !isStrings(stash)) return null;
	if (tally !== undefined && !isTally(tally)) return null;
	const records = history === undefined ? undefined : readAll(history, readRecord);
	if (records === null) return null;
	const searches = finds === undefined ? undefined : readFinds(finds);
	if (searches === null) return null;
	return {
		id,
		game,
		factionId,
		name,
		picks: picks as Record<string, string[]>,
		fighters: read as FighterInstance[],
		...(colour !== undefined ? { colour: colour as string | null } : {}),
		...(fluff !== undefined ? { fluff: fluff as string } : {}),
		...(notes !== undefined ? { notes: notes as string } : {}),
		...(gold !== undefined ? { gold } : {}),
		...(stash !== undefined ? { stash } : {}),
		...(records !== undefined ? { history: records } : {}),
		...(searches !== undefined ? { finds: searches } : {}),
		...(tally !== undefined ? { tally } : {}),
		...(updatedAt !== undefined ? { updatedAt: updatedAt as string } : {})
	};
}

export function readWarbandFile(text: string, known: Known): ReadResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, message: 'That file is not valid JSON.' };
	}
	if (!isObject(parsed)) return { ok: false, message: 'That file does not look like a warband.' };
	if (parsed.format !== FORMAT) {
		const other = known.other?.(parsed);
		if (other) return other;
	}
	if (parsed.format !== FORMAT) return { ok: false, message: 'That file does not look like a warband.' };
	if (typeof parsed.version !== 'number' || parsed.version > VERSION) {
		return { ok: false, message: 'This file comes from a newer version of the app. Reload the app and try again.' };
	}

	const warband = readWarband(parsed.warband);
	if (!warband) return { ok: false, message: 'This warband file is damaged: some of its fields are missing or wrong.' };

	const game = known.game(warband.game);
	if (!game) return { ok: false, message: `This warband is for a game the app does not know: ${warband.game}.` };
	if (!known.faction(warband.game, warband.factionId)) {
		return { ok: false, message: `This warband's faction is not one ${game} has here: ${warband.factionId}.` };
	}

	return { ok: true, warband };
}

/**
 * How an incoming warband stands to the one stored under its id. Judged by when
 * each last changed; a state without that date cannot be placed. Two devices
 * that both moved on from the same state read as newer or older by their dates
 * alone – nothing here can tell that both hold changes the other lacks.
 */
export type Verdict =
	| { kind: 'new' }
	| { kind: 'same' }
	| { kind: 'newer'; stored: string; incoming: string }
	| { kind: 'older'; stored: string; incoming: string }
	| { kind: 'unknown' };

export function judge(incoming: Warband, stored: Warband | null): Verdict {
	if (!stored) return { kind: 'new' };
	if (sameWarband(incoming, stored)) return { kind: 'same' };
	if (!incoming.updatedAt || !stored.updatedAt) return { kind: 'unknown' };
	const order = incoming.updatedAt.localeCompare(stored.updatedAt);
	if (order > 0) return { kind: 'newer', stored: stored.updatedAt, incoming: incoming.updatedAt };
	/* Equal dates with different content cannot come out of one device; it is
	   the case the dates cannot settle. */
	if (order === 0) return { kind: 'unknown' };
	return { kind: 'older', stored: stored.updatedAt, incoming: incoming.updatedAt };
}
