/**
 * Creating and changing a warband, the same for every game. A warband only
 * stores ids; costs and names are looked up from its faction.
 */

import type { Faction, Fighter, FighterInstance, GameSystem, Span, StatDef, Warband } from './types';

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

/** A limit as a heading or a column prints it: `1`, `0–3`, `5+`, `any`. */
export function formatSpan(limit: Span): string {
	if (limit.max === null) return limit.min ? `${limit.min}+` : 'any';
	if (limit.min === limit.max) return `${limit.min}`;
	return `${limit.min}–${limit.max}`;
}

/** A run of a faction's fighters under one heading, for the faction's preview and the recruit list. */
export interface FighterSection {
	/** `Leaders (1)`, `Heroes`; null where the game lists its fighters as one. */
	label: string | null;
	/** Whether the heading names the limit, so a fighter's own only matters where it is tighter. */
	limited: boolean;
	fighters: Fighter[];
}

/**
 * Where the game counts fighters in groups, as Black Death City does, the
 * fighters follow them like the rulebook's Fighters List: "Leaders (1)" and so
 * on. A game without groups but with role headings, as Wyrdcry, puts each
 * fighter under its role as roleKeyOf finds it; those headings set no limit.
 * Fighters no heading takes come last, under Other. Without either it is one list.
 */
export function fighterSections(faction: Faction, game: GameSystem): FighterSection[] {
	const labels = game.roleLabels;
	if (!game.groups.length && !labels) return [{ label: null, limited: false, fighters: faction.fighters }];
	const grouped: FighterSection[] = game.groups.length
		? game.groups.map((g) => ({
				label: `${g.label} (${formatSpan(g.limit)})`,
				limited: true,
				fighters: faction.fighters.filter((f) => f.keywords.includes(g.keyword))
			}))
		: game.roles
				.filter((r) => labels?.[r])
				.map((r) => ({
					label: labels![r],
					limited: false,
					fighters: faction.fighters.filter((f) => roleKeyOf(f, game) === r)
				}));
	const placed = new Set(grouped.flatMap((s) => s.fighters));
	const rest = faction.fighters.filter((f) => !placed.has(f));
	return [...grouped, ...(rest.length ? [{ label: 'Other', limited: false, fighters: rest }] : [])].filter(
		(s) => s.fighters.length
	);
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
