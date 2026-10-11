/**
 * The warbands, kept in the browser's IndexedDB. The data is bound to the
 * app's address: move the app elsewhere and it is gone. A battle in progress
 * lies beside its warband in a store of its own, so a tap at the table never
 * touches the warband.
 *
 * Storage can be missing or refuse to write (blocked site data, a full disk).
 * Reading then yields nothing and a write resolves to false; either way
 * `storage.failing` turns true, and stays so for the visit, so the page can tell
 * the player to export what they want to keep.
 */

import type { BattleState } from './battle';
import type { Warband } from './types';
import { sameWarband } from './warband';

const DB_NAME = 'fantasy-city-warbands';
const DB_VERSION = 1;
const WARBANDS = 'warbands';
/** Keyed by the warband's id. */
const BATTLES = 'battles';
const META = 'meta';

/*
 * Where the warbands lay in localStorage. Whatever is still there is carried
 * over each time the database opens – from a device that ran an earlier
 * version, a tab still open on one, or a fixture put there by hand.
 */
const LEGACY_WARBANDS = 'fantasy-city-warbands:warbands';
const LEGACY_BATTLE = 'fantasy-city-warbands:battle:';
const LEGACY_SOUND = 'fantasy-city-warbands:sound';

export const storage = $state({ failing: false });

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			for (const name of [WARBANDS, BATTLES, META]) {
				if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
			}
		};
		request.onsuccess = () => {
			/* A window still on an older version would block the upgrade in another one. */
			request.result.onversionchange = () => {
				request.result.close();
				dbPromise = null;
			};
			resolve(request.result);
		};
		request.onerror = () => reject(request.error);
	})
		.then(carryOver)
		.catch((error) => {
			dbPromise = null;
			storage.failing = true;
			throw error;
		});
	return dbPromise;
}

type Legacy = { keys: string[]; warbands: Warband[]; battles: [string, BattleState][]; soundOff: boolean };

/** What localStorage still holds. A key that does not parse is left out, and so left in place. */
function readLegacy(): Legacy | null {
	const legacy: Legacy = { keys: [], warbands: [], battles: [], soundOff: false };
	try {
		const raw = localStorage.getItem(LEGACY_WARBANDS);
		if (raw !== null) {
			try {
				const parsed: unknown = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					legacy.warbands = parsed.filter((w) => typeof w?.id === 'string');
					legacy.keys.push(LEGACY_WARBANDS);
				}
			} catch {
				/* Unreadable: stays where it is. */
			}
		}
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key?.startsWith(LEGACY_BATTLE)) continue;
			try {
				legacy.battles.push([key.slice(LEGACY_BATTLE.length), JSON.parse(localStorage.getItem(key)!)]);
				legacy.keys.push(key);
			} catch {
				/* Unreadable: stays where it is. */
			}
		}
		if (localStorage.getItem(LEGACY_SOUND) !== null) {
			legacy.soundOff = localStorage.getItem(LEGACY_SOUND) === 'off';
			legacy.keys.push(LEGACY_SOUND);
		}
	} catch {
		return null;
	}
	return legacy.keys.length ? legacy : null;
}

/*
 * One transaction for all of it, and localStorage is cleared only once that
 * transaction has completed: interrupted, nothing is lost and the next visit
 * tries again. A warband in both places keeps the later change; on a tie, or
 * without a date, the one already in the database stays. A battle or a sound
 * setting already in the database stays too.
 */
async function carryOver(db: IDBDatabase): Promise<IDBDatabase> {
	const legacy = readLegacy();
	if (!legacy) return db;
	try {
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction([WARBANDS, BATTLES, META], 'readwrite');
			const warbands = tx.objectStore(WARBANDS);
			for (const w of legacy.warbands) {
				const request = warbands.get(w.id);
				request.onsuccess = () => {
					const stored = request.result as Warband | undefined;
					if (!stored || (w.updatedAt && stored.updatedAt && w.updatedAt > stored.updatedAt)) warbands.put(w, w.id);
				};
			}
			const battles = tx.objectStore(BATTLES);
			for (const [id, battle] of legacy.battles) {
				const request = battles.count(id);
				request.onsuccess = () => {
					if (request.result === 0) battles.put(battle, id);
				};
			}
			if (legacy.soundOff) {
				const meta = tx.objectStore(META);
				const request = meta.count('sound');
				request.onsuccess = () => {
					if (request.result === 0) meta.put(false, 'sound');
				};
			}
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		});
		for (const key of legacy.keys) localStorage.removeItem(key);
	} catch {
		/* The database works; what is in localStorage waits for the next visit. */
	}
	return db;
}

function read<T>(store: string, fn: (s: IDBObjectStore) => IDBRequest, fallback: T): Promise<T> {
	return open()
		.then(
			(db) =>
				new Promise<T>((resolve, reject) => {
					const request = fn(db.transaction(store, 'readonly').objectStore(store));
					request.onsuccess = () => resolve(request.result as T);
					request.onerror = () => reject(request.error);
				})
		)
		.catch(() => fallback);
}

/** Runs `fn` in one readwrite transaction; true once it has completed. A failure is flagged and resolves to false. */
function write(stores: string[], fn: (tx: IDBTransaction) => void): Promise<boolean> {
	return open()
		.then(
			(db) =>
				new Promise<void>((resolve, reject) => {
					const tx = db.transaction(stores, 'readwrite');
					fn(tx);
					tx.oncomplete = () => resolve();
					tx.onerror = () => reject(tx.error);
					tx.onabort = () => reject(tx.error);
				})
		)
		.then(
			() => true,
			() => {
				storage.failing = true;
				return false;
			}
		);
}

/** In no particular order; the page sorts them. */
export function loadWarbands(): Promise<Warband[]> {
	return read<Warband[]>(WARBANDS, (s) => s.getAll(), []);
}

export async function loadWarband(id: string): Promise<Warband | null> {
	return (await read<Warband | undefined>(WARBANDS, (s) => s.get(id), undefined)) ?? null;
}

/**
 * Adds the warband, or replaces the stored one with the same id. A change is
 * dated; a save that changes nothing – the builder saves on opening – writes
 * nothing, so the date stays the one of the last real change. Reading and
 * writing share one transaction, so quick saves one after another land in order.
 *
 * An import keeps the date the file carries (`dated: false`): it is the same
 * state, not a new one.
 *
 * IndexedDB clones structurally and trips over a reactive proxy: pass a plain
 * object, `$state.snapshot` of it.
 */
export function saveWarband(warband: Warband, dated = true): Promise<boolean> {
	return write([WARBANDS], (tx) => {
		const s = tx.objectStore(WARBANDS);
		const request = s.get(warband.id);
		request.onsuccess = () => {
			const stored = request.result as Warband | undefined;
			if (stored && sameWarband(stored, warband) && (dated || stored.updatedAt === warband.updatedAt)) return;
			s.put(dated ? { ...warband, updatedAt: new Date().toISOString() } : warband, warband.id);
		};
	});
}

/** The warband and the battle it was in the middle of. */
export function deleteWarband(id: string): Promise<boolean> {
	return write([WARBANDS, BATTLES], (tx) => {
		tx.objectStore(WARBANDS).delete(id);
		tx.objectStore(BATTLES).delete(id);
	});
}

export async function loadBattle(warbandId: string): Promise<BattleState | null> {
	return (await read<BattleState | undefined>(BATTLES, (s) => s.get(warbandId), undefined)) ?? null;
}

/** Null ends the battle. */
export function saveBattle(warbandId: string, battle: BattleState | null): Promise<boolean> {
	return write([BATTLES], (tx) => {
		const s = tx.objectStore(BATTLES);
		if (battle) s.put(battle, warbandId);
		else s.delete(warbandId);
	});
}

/** Whether a fighter going out of action is heard. On unless switched off on this device. */
export async function loadSound(): Promise<boolean> {
	return (await read<boolean | undefined>(META, (s) => s.get('sound'), undefined)) !== false;
}

export function saveSound(on: boolean): Promise<boolean> {
	return write([META], (tx) => {
		const s = tx.objectStore(META);
		if (on) s.delete('sound');
		else s.put(false, 'sound');
	});
}

/**
 * Asks the browser not to discard the data when storage runs low or the site
 * has gone unvisited. Safari essentially grants this to installed apps only.
 */
export async function requestPersistence(): Promise<boolean> {
	try {
		if (!navigator.storage?.persist) return false;
		if (await navigator.storage.persisted()) return true;
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}
