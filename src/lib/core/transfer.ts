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

import type { FighterInstance, Warband } from './types';
import { sameWarband } from './warband';

export const FORMAT = 'fantasy-city-warbands';
/** Raised whenever the shape of `warband` changes in a way an import has to know about. */
export const VERSION = 1;

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

/** What reading a file came to: a warband to offer, or why there is none. */
export type ReadResult = { ok: true; warband: Warband } | { ok: false; message: string };

/** Answers whether the app knows a game and a faction, by name for the message where it does not. */
export interface Known {
	game(id: string): string | null;
	faction(game: string, id: string): string | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function readFighter(raw: unknown): FighterInstance | null {
	if (!isObject(raw)) return null;
	const { instanceId, fighterId, name, wargear, picks, fluff, notes } = raw;
	if (typeof instanceId !== 'string' || typeof fighterId !== 'string' || typeof name !== 'string' || !isStrings(wargear)) return null;
	if (picks !== undefined && !isStrings(picks)) return null;
	for (const text of [fluff, notes]) if (text !== undefined && typeof text !== 'string') return null;
	return {
		instanceId,
		fighterId,
		name,
		wargear,
		...(picks ? { picks } : {}),
		...(fluff !== undefined ? { fluff: fluff as string } : {}),
		...(notes !== undefined ? { notes: notes as string } : {})
	};
}

/**
 * Only the fields the app knows, so nothing a file brings along ends up
 * stored. A fighter type or a piece of wargear the faction lacks is let
 * through: the cards name it as unknown, as they do for a stored warband.
 */
function readWarband(raw: unknown): Warband | null {
	if (!isObject(raw)) return null;
	const { id, game, factionId, name, picks, fighters, colour, fluff, notes, updatedAt } = raw;
	if (typeof id !== 'string' || typeof game !== 'string' || typeof factionId !== 'string' || typeof name !== 'string') return null;
	if (!isObject(picks) || !Object.values(picks).every(isStrings) || !Array.isArray(fighters)) return null;
	const read = fighters.map(readFighter);
	if (read.some((f) => f === null)) return null;
	if (colour !== undefined && colour !== null && typeof colour !== 'string') return null;
	for (const text of [fluff, notes, updatedAt]) if (text !== undefined && typeof text !== 'string') return null;
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
		...(updatedAt !== undefined ? { updatedAt: updatedAt as string } : {})
	};
}

/**
 * A file out of the Wyrdcry Warband Deck or the Warband Builder: the warband at
 * the top, the deck's own data under `_deck`, and a fighter's gear under
 * `equipment`.
 */
function isDeckOrBuilder(parsed: Record<string, unknown>): boolean {
	return (
		'_deck' in parsed ||
		(Array.isArray(parsed.fighters) && parsed.fighters.some((f) => isObject(f) && 'equipment' in f))
	);
}

export function readWarbandFile(text: string, known: Known): ReadResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, message: 'That file is not valid JSON.' };
	}
	if (!isObject(parsed)) return { ok: false, message: 'That file does not look like a warband.' };
	if (isDeckOrBuilder(parsed)) {
		return {
			ok: false,
			message: 'This is a file from the Wyrdcry Warband Deck or the Warband Builder. Those cannot be imported yet.'
		};
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
