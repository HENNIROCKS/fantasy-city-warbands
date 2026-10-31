/**
 * Dividing a warband into battle groups, where the game's scenarios do: the
 * groups, which start on the field and which wait in reserve, and the
 * reinforcements that arrive from it. The reserve is a mark the scenario
 * carries (`GameSystem.scenarios.reserve`), so a fighter in reserve has no
 * activation to make like any other that has left the battlefield.
 */

import { setMark, start, withoutGroups, type BattleGroups, type BattleState } from './battle';
import { scenarioOf } from './scenario';
import type { GameSystem, GroupOverride, GroupRule, ReinforcementTable, Warband } from './types';
import { underdogSide } from './underdog';

/** The side of the battle the rules of a scenario tell apart. */
export type GroupSide = 'underdog' | 'other';

/** Which side the warband is on, where the scenario asks: the underdog, else the other, also while the underdog is not known. */
export function groupSide(game: GameSystem, warband: Warband, battle: BattleState | null): GroupSide {
	return underdogSide(game.underdog, warband, battle) === 'you' ? 'underdog' : 'other';
}

/**
 * The battle groups of the scenario picked as the warband's side has them: the
 * scenario's rule, the underdog's changes to it, then the twist's. Null where
 * the scenario has no groups or its twist takes them away.
 */
export function groupRule(game: GameSystem, battle: BattleState | null, side: GroupSide): GroupRule | null {
	const picked = scenarioOf(game, battle);
	const base = picked?.scenario.groups;
	if (!picked || !base || picked.twist?.groups === null) return null;
	const { underdog, ...rule } = base;
	const apply = (rule: GroupRule, change: GroupOverride | undefined): GroupRule => {
		if (!change || (change.for && change.for !== side)) return rule;
		const { for: _for, ...rest } = change;
		return { ...rule, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) };
	};
	return apply(apply(rule, side === 'underdog' ? underdog : undefined), picked.twist?.groups);
}

/** The table a fighter in reserve rolls on: the rule's own, the game's, or none where the groups arrive without a roll. */
export function reinforcementTable(game: GameSystem, rule: GroupRule): ReinforcementTable | null {
	return rule.reinforcements === undefined ? (game.scenarios?.reinforcements ?? null) : rule.reinforcements;
}

/** The fighters by group as evenly as possible, in the order given: 10 in 3 groups make 3, 3 and 4. */
export function splitGroups(ids: string[], count: number): Record<string, number> {
	const base = Math.floor(ids.length / count);
	const extra = ids.length % count;
	const of: Record<string, number> = {};
	let at = 0;
	for (let group = 1; group <= count; group++) {
		const size = base + (group > count - extra ? 1 : 0);
		for (let i = 0; i < size; i++) of[ids[at++]] = group;
	}
	return of;
}

/**
 * The groups as they stand for the fighters given: as stored where they still
 * fit the rule's count, with a fighter added since put into the smallest group
 * and one gone dropped; else a new even split with the rule's first groups on
 * the field.
 */
export function groupsFor(battle: BattleState | null, ids: string[], rule: GroupRule): BattleGroups {
	const stored = battle?.groups;
	if (!stored || stored.count !== rule.count) {
		return { count: rule.count, of: splitGroups(ids, rule.count), start: Array.from({ length: Math.min(rule.start ?? 1, rule.count) }, (_, i) => i + 1) };
	}
	const of: Record<string, number> = {};
	for (const id of ids) if (stored.of[id] !== undefined) of[id] = stored.of[id];
	for (const id of ids) {
		if (of[id] !== undefined) continue;
		const sizes = Array.from({ length: stored.count }, (_, i) => Object.values(of).filter((g) => g === i + 1).length);
		of[id] = sizes.indexOf(Math.min(...sizes)) + 1;
	}
	return { ...stored, of };
}

/** The groups with two fighters changing places, which keeps their sizes. */
export function swapFighters(groups: BattleGroups, a: string, b: string): BattleGroups {
	return { ...groups, of: { ...groups.of, [a]: groups.of[b], [b]: groups.of[a] } };
}

/** The groups with one fighter moved to another, which makes the sizes unequal. */
export function moveFighter(groups: BattleGroups, id: string, group: number): BattleGroups {
	return { ...groups, of: { ...groups.of, [id]: group } };
}

/** The groups with one group started on the field or sent to reserve. */
export function toggleStart(groups: BattleGroups, group: number): BattleGroups {
	const start = groups.start.includes(group) ? groups.start.filter((g) => g !== group) : [...groups.start, group].sort((a, b) => a - b);
	return { ...groups, start };
}

/** The battle with the groups kept and every fighter outside the groups that start put in reserve, the others taken out of it. */
export function applyGroups(game: GameSystem, battle: BattleState | null, groups: BattleGroups): BattleState {
	const key = game.scenarios?.reserve;
	let next: BattleState = { ...(battle ?? start()), groups };
	if (!key) return next;
	for (const [id, group] of Object.entries(groups.of)) next = setMark(next, id, key, !groups.start.includes(group));
	return next;
}

/** The battle without its groups and without anyone in reserve. */
export function resetGroups(game: GameSystem, battle: BattleState): BattleState {
	return withoutGroups(battle, game.scenarios?.reserve);
}

/** The fighters in reserve among those given, in the order given; one taken out of action is no longer waiting to arrive. */
export function inReserve(game: GameSystem, battle: BattleState | null, ids: string[]): string[] {
	const key = game.scenarios?.reserve;
	return key ? ids.filter((id) => battle?.fighters[id]?.marks?.[key] && !battle.fighters[id]?.out) : [];
}

/** The battle with the fighters arrived: no longer in reserve. */
export function arrive(game: GameSystem, battle: BattleState | null, ids: string[]): BattleState | null {
	const key = game.scenarios?.reserve;
	if (!key || !battle) return battle;
	return ids.reduce<BattleState>((next, id) => setMark(next, id, key, false), battle);
}
