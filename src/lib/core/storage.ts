/**
 * The warbands, kept in the browser's localStorage. Storage can be missing or
 * refuse to write (a private window, blocked site data), so every access is
 * guarded: reading then yields nothing, and writing fails quietly.
 */

import type { BattleState } from './battle';
import type { Warband } from './types';
import { sameWarband } from './warband';

const KEY = 'fantasy-city-warbands:warbands';
/** One key per warband, so a tap at the table writes only its own battle. */
const BATTLE_KEY = 'fantasy-city-warbands:battle:';
const SOUND_KEY = 'fantasy-city-warbands:sound';

export function loadWarbands(): Warband[] {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as Warband[]) : [];
	} catch {
		return [];
	}
}

function store(warbands: Warband[]): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(warbands));
	} catch {
		/* Nothing to fall back to; the warband stays in memory for this visit. */
	}
}

export function loadWarband(id: string): Warband | null {
	return loadWarbands().find((w) => w.id === id) ?? null;
}

/**
 * Adds the warband, or replaces the stored one with the same id. A change is
 * dated; a save that changes nothing – the builder saves on opening – writes
 * nothing, so the date stays the one of the last real change.
 *
 * An import keeps the date the file carries (`dated: false`): it is the same
 * state, not a new one.
 */
export function saveWarband(warband: Warband, dated = true): void {
	const warbands = loadWarbands();
	const index = warbands.findIndex((w) => w.id === warband.id);
	const stored = index === -1 ? null : warbands[index];
	if (stored && sameWarband(stored, warband) && (dated || stored.updatedAt === warband.updatedAt)) return;
	const saved = dated ? { ...warband, updatedAt: new Date().toISOString() } : warband;
	if (index === -1) warbands.push(saved);
	else warbands[index] = saved;
	store(warbands);
}

export function deleteWarband(id: string): void {
	store(loadWarbands().filter((w) => w.id !== id));
	saveBattle(id, null);
}

export function loadBattle(warbandId: string): BattleState | null {
	try {
		const raw = localStorage.getItem(BATTLE_KEY + warbandId);
		return raw ? (JSON.parse(raw) as BattleState) : null;
	} catch {
		return null;
	}
}

/** Null ends the battle. */
export function saveBattle(warbandId: string, battle: BattleState | null): void {
	try {
		if (battle) localStorage.setItem(BATTLE_KEY + warbandId, JSON.stringify(battle));
		else localStorage.removeItem(BATTLE_KEY + warbandId);
	} catch {
		/* The battle stays in memory for this visit. */
	}
}

/** Whether a fighter going out of action is heard. On unless switched off on this device. */
export function loadSound(): boolean {
	try {
		return localStorage.getItem(SOUND_KEY) !== 'off';
	} catch {
		return true;
	}
}

export function saveSound(on: boolean): void {
	try {
		if (on) localStorage.removeItem(SOUND_KEY);
		else localStorage.setItem(SOUND_KEY, 'off');
	} catch {
		/* Holds for this visit. */
	}
}
