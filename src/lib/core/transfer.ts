/**
 * A warband as a file of its own. There is no sync: an export is a deliberate
 * act, and the file is the copy that survives the browser's storage.
 *
 * The warband sits inside an envelope that says what it is and in which shape,
 * so an import can tell this app's files from the Warband Deck's and the
 * Warband Builder's, and an older shape of its own from the current one. The
 * battle running on this device is not part of it.
 */

import type { Warband } from './types';

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
