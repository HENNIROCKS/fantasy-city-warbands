/**
 * What the options a warband has picked change about the fighters it may
 * have: who leads it, how many of a fighter it may take, who counts towards a
 * group. The checks and the recruiting step both read the limits from here, so
 * the warband is never offered what the check would then refuse.
 */

import type { ChoiceEffect, Faction, Fighter, Span, Warband } from './types';

/** Both games mark the fighter that leads a warband with this keyword. */
export const LEADER = 'leader';

export interface ActiveEffect {
	/** The option's name, for the message that names the reason. */
	source: string;
	effect: ChoiceEffect;
}

/** The effects of every option the warband has picked. */
export function activeEffects(warband: Warband, faction: Faction): ActiveEffect[] {
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

/** Whether a fighter counts towards the game's groups. */
export function isGrouped(fighterId: string, effects: ActiveEffect[]): boolean {
	return !effects.some(({ effect }) => effect.ungrouped?.includes(fighterId));
}
