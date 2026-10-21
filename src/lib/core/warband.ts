/**
 * Creating and changing a warband, the same for every game. A warband only
 * stores ids; costs and names are looked up from its faction.
 */

import { pickedStats, recruitCost, type ActiveEffect } from './effects';
import type { Faction, Fighter, FighterChoiceOption, FighterInstance, GameSystem, Span, StatDef, Warband } from './types';

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

/** Whether two warbands hold the same, leaving out when each was last changed. */
export function sameWarband(a: Warband, b: Warband): boolean {
	const { updatedAt: _a, ...left } = a;
	const { updatedAt: _b, ...right } = b;
	return equal(left, right);
}

function equal(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	/* A key holding `undefined` is a key the JSON on disk does not have. */
	const keys = (o: object) => Object.keys(o).filter((k) => (o as Record<string, unknown>)[k] !== undefined);
	const ka = keys(a);
	if (ka.length !== keys(b).length) return false;
	return ka.every((k) => equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export function createFighter(fighterId: string): FighterInstance {
	return { instanceId: newId(), fighterId, name: '', wargear: [], picks: [] };
}

/** The options picked under the fighter's own choice, in the order the choice offers them. */
export function chosenOptions(instance: FighterInstance, fighter: Fighter): FighterChoiceOption[] {
	const picks = instance.picks ?? [];
	return fighter.choice?.options.filter((o) => picks.includes(o.id)) ?? [];
}

/**
 * The fighter's profile with what its own picks add, such as Fight +1 from
 * Martial Discipline, and what the warband's add, such as Huntsmen's Shoot +1.
 */
export function profileOf(instance: FighterInstance, fighter: Fighter, effects: ActiveEffect[]): Fighter['profile'] {
	const profile = { ...fighter.profile };
	const raise = (key: string, bonus: number) => {
		const value = profile[key];
		if (typeof value === 'number') profile[key] = value + bonus;
	};
	for (const option of chosenOptions(instance, fighter)) {
		for (const [key, bonus] of Object.entries(option.bonus ?? {})) raise(key, bonus);
	}
	for (const { stat, bonus } of pickedStats(fighter, effects)) raise(stat, bonus);
	return profile;
}

/** A fighter's type as the faction names it, else its id. */
export function fighterType(instance: FighterInstance, faction: Faction): string {
	return faction.fighters.find((f) => f.id === instance.fighterId)?.name ?? instance.fighterId;
}

/** A fighter's own name, else `Unnamed` and its type, so a name left to give shows as such. */
export function fighterName(instance: FighterInstance, faction: Faction): string {
	return instance.name.trim() || `Unnamed ${fighterType(instance, faction)}`;
}

/** What one fighter costs with everything it carries, the warband's picks counted into its own price. */
export function fighterCost(instance: FighterInstance, faction: Faction, effects: ActiveEffect[]): number {
	const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
	const base = fighter ? recruitCost(fighter, effects) : 0;
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
	/** The heading without its limit: `Leaders`. */
	title: string | null;
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
	if (!game.groups.length && !labels) return [{ label: null, title: null, limited: false, fighters: faction.fighters }];
	const grouped: FighterSection[] = game.groups.length
		? game.groups.map((g) => ({
				label: `${g.label} (${formatSpan(g.limit)})`,
				title: g.label,
				limited: true,
				fighters: faction.fighters.filter((f) => f.keywords.includes(g.keyword))
			}))
		: game.roles
				.filter((r) => labels?.[r])
				.map((r) => ({
					label: labels![r],
					title: labels![r],
					limited: false,
					fighters: faction.fighters.filter((f) => roleKeyOf(f, game) === r)
				}));
	const placed = new Set(grouped.flatMap((s) => s.fighters));
	const rest = faction.fighters.filter((f) => !placed.has(f));
	return [...grouped, ...(rest.length ? [{ label: 'Other', title: 'Other', limited: false, fighters: rest }] : [])].filter(
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

/**
 * The wargear on offer that this fighter could never take, whatever else it
 * carries – a HEROes' weapon for a henchman, armour for a WIZARD – by id, with
 * the game's short reason. The game's carrying rules refuse it on its own.
 */
export function neverCarried(fighter: Fighter, faction: Faction, game: GameSystem): Map<string, string> {
	const never = new Map<string, string>();
	for (const id of fighter.wargear) {
		const refused = game.carry?.(fighter, faction, [id])[0];
		if (refused) never.set(id, refused.short);
	}
	return never;
}

/**
 * The fighters in the order of the game's roles – for Wyrdcry the leader, the
 * heroes, the henchmen – and whoever carries none of them last, as a BEAST or a
 * THRALL; not by the default role, which would put them among the henchmen.
 * Stable, so within a role they stay in the order they were recruited. As the
 * Warband Deck orders its roster.
 */
export function inRankOrder(fighters: FighterInstance[], faction: Faction, game: GameSystem): FighterInstance[] {
	const rankOf = (instance: FighterInstance) => {
		const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
		const at = fighter ? game.roles.findIndex((r) => fighter.keywords.includes(r)) : -1;
		return at < 0 ? game.roles.length : at;
	};
	return [...fighters].sort((a, b) => rankOf(a) - rankOf(b));
}

/**
 * The recruit takes its place by role, and the warband falls into that order
 * with it. It starts with the counters the game gives a fighter of its kind.
 */
export function withFighter(warband: Warband, fighterId: string, faction: Faction, game: GameSystem): Warband {
	const type = faction.fighters.find((f) => f.id === fighterId);
	const tally = type ? game.campaign?.recruited?.(type) : undefined;
	const recruit = { ...createFighter(fighterId), ...(tally && Object.keys(tally).length ? { tally } : {}) };
	return { ...warband, fighters: inRankOrder([...warband.fighters, recruit], faction, game) };
}

/**
 * Another recruit of the fighter's type, picking and carrying what it does.
 * Nothing it gained or lost in a campaign comes along, nor its name or texts.
 */
export function withCopy(warband: Warband, instanceId: string, faction: Faction, game: GameSystem): Warband {
	const model = warband.fighters.find((f) => f.instanceId === instanceId);
	if (!model) return warband;
	const added = withFighter(warband, model.fighterId, faction, game);
	const recruit = added.fighters.find((f) => !warband.fighters.some((g) => g.instanceId === f.instanceId))!;
	const copy = { ...recruit, wargear: [...model.wargear], picks: [...(model.picks ?? [])] };
	return { ...added, fighters: added.fighters.map((f) => (f.instanceId === recruit.instanceId ? copy : f)) };
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
