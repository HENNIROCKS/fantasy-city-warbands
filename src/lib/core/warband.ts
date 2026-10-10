/**
 * Creating and changing a warband, the same for every game. A warband only
 * stores ids; costs and names are looked up from its faction.
 */

import type { Faction, Fighter, FighterInstance, GameSystem, StatDef, Warband } from './types';

/**
 * A random id. Not `crypto.randomUUID()`: that only exists in a secure context,
 * and a phone opening the dev server by its network address is not one.
 */
export function newId(): string {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function createWarband(game: string, faction: Faction, name: string): Warband {
	return {
		id: newId(),
		game,
		factionId: faction.id,
		name,
		picks: Object.fromEntries(faction.choices.map((c) => [c.id, []])),
		fighters: []
	};
}

export function createFighter(fighterId: string): FighterInstance {
	return { instanceId: newId(), fighterId, name: '', wargear: [] };
}

/** What one fighter costs with everything it carries. */
export function fighterCost(instance: FighterInstance, faction: Faction): number {
	const base = faction.fighters.find((f) => f.id === instance.fighterId)?.cost ?? 0;
	return instance.wargear.reduce((sum, id) => sum + (faction.wargear.find((w) => w.id === id)?.cost ?? 0), base);
}

/** A fighter's role keyword, the first of the game's roles it carries, else the game's default: `leader`. */
export function roleKeyOf(fighter: Fighter, game: GameSystem): string | null {
	return game.roles.find((r) => fighter.keywords.includes(r)) ?? game.defaultRole ?? null;
}

/** A fighter's role as the game names it, capitalised: `Leader`, `Brute`. Null where it has none. */
export function roleOf(fighter: Fighter, game: GameSystem): string | null {
	const role = roleKeyOf(fighter, game);
	return role ? role[0].toUpperCase() + role.slice(1) : null;
}

/** A characteristic as the profile prints it: `5"`, `3+`, `4`, a dash where there is none, or a roll as printed. */
export function formatStat(def: StatDef, value: number | string | null | undefined): string {
	if (value === null || value === undefined) return '–';
	if (typeof value === 'string') return value;
	if (def.format === 'inches') return `${value}"`;
	if (def.format === 'target') return `${value}+`;
	return String(value);
}

/*
 * The warband as it would be after a change, built beside it rather than into
 * it, so the change can be checked before it is offered. Shallow: only what the
 * change touches is copied.
 */

export function withFighter(warband: Warband, fighterId: string): Warband {
	return { ...warband, fighters: [...warband.fighters, createFighter(fighterId)] };
}

export function withInstance(warband: Warband, instance: FighterInstance, index: number): Warband {
	const fighters = [...warband.fighters];
	fighters.splice(Math.min(index, fighters.length), 0, instance);
	return { ...warband, fighters };
}

export function withWargear(warband: Warband, instanceId: string, wargearId: string): Warband {
	return {
		...warband,
		fighters: warband.fighters.map((f) =>
			f.instanceId === instanceId ? { ...f, wargear: [...f.wargear, wargearId] } : f
		)
	};
}

export function withPicks(warband: Warband, choiceId: string, picked: string[]): Warband {
	return { ...warband, picks: { ...warband.picks, [choiceId]: picked } };
}
