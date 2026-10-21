/**
 * What the options a warband has picked change about the fighters it may
 * have: who leads it, how many of a fighter it may take, who counts towards a
 * group, what a fighter costs and what its profile adds. The checks and the
 * recruiting step both read the limits from here, so the warband is never
 * offered what the check would then refuse.
 */

import type { ChoiceEffect, ChoiceStat, Faction, Fighter, Span, Warband } from './types';

/** Both games mark the fighter that leads a warband with this keyword. */
export const LEADER = 'leader';

export interface ActiveEffect {
	/** The option's name, for the message that names the reason. */
	source: string;
	effect: ChoiceEffect;
}

/** The effects of every option the warband has picked. */
export function activeEffects(warband: Pick<Warband, 'picks'>, faction: Faction): ActiveEffect[] {
	return faction.choices.flatMap((choice) =>
		choice.options
			.filter((o) => o.effect && warband.picks[choice.id]?.includes(o.id))
			.map((o) => ({ source: o.name, effect: o.effect! }))
	);
}

export interface EffectiveLimit {
	limit: Span;
	/** The option that set the limit, or null where it is the fighter's own. */
	source: string | null;
}

/** How many of a fighter the warband may have, with its picks counted in. */
export function limitOf(fighter: Fighter, effects: ActiveEffect[]): EffectiveLimit {
	let result: EffectiveLimit = { limit: fighter.limit, source: null };
	for (const { source, effect } of effects) {
		const override = effect.limits?.find((l) => l.fighter === fighter.id);
		if (override) result = { limit: override.limit, source };
		if (effect.leader && fighter.keywords.includes(LEADER)) {
			result =
				effect.leader === fighter.id
					? { limit: { min: 1, max: result.limit.max }, source }
					: { limit: { min: 0, max: 0 }, source };
		}
	}
	return result;
}

/** What recruiting a fighter costs with the picks counted in, rounded as the Warband Deck rounds it. */
export function recruitCost(fighter: Fighter, effects: ActiveEffect[]): number {
	let cost = fighter.cost;
	for (const { effect } of effects) {
		const share = effect.costs?.find((c) => c.fighter === fighter.id);
		if (share) cost = Math.round(cost * share.factor);
	}
	return cost;
}

/** Whether a picked characteristic reaches this fighter. */
export function reaches(stat: ChoiceStat, fighterId: string): boolean {
	return stat.fighters === 'all' || stat.fighters.includes(fighterId);
}

/** What the picks add to a fighter's characteristics, each by the option's name. */
export function pickedStats(fighter: Fighter, effects: ActiveEffect[]): { stat: string; bonus: number; source: string }[] {
	return effects.flatMap(({ source, effect }) =>
		(effect.stats ?? []).filter((s) => reaches(s, fighter.id)).map((s) => ({ stat: s.stat, bonus: s.bonus, source }))
	);
}

/** Whether a fighter counts towards the game's groups. */
export function isGrouped(fighterId: string, effects: ActiveEffect[]): boolean {
	return !effects.some(({ effect }) => effect.ungrouped?.includes(fighterId));
}
