/**
 * The warbands, kept in the browser's localStorage. Storage can be missing or
 * refuse to write (a private window, blocked site data), so every access is
 * guarded: reading then yields nothing, and writing fails quietly.
 */

import type { Warband } from './types';

const KEY = 'fantasy-city-warbands:warbands';

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

/** Adds the warband, or replaces the stored one with the same id. */
export function saveWarband(warband: Warband): void {
	const warbands = loadWarbands();
	const index = warbands.findIndex((w) => w.id === warband.id);
	if (index === -1) warbands.push(warband);
	else warbands[index] = warband;
	store(warbands);
}

export function deleteWarband(id: string): void {
	store(loadWarbands().filter((w) => w.id !== id));
}
