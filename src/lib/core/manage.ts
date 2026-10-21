/**
 * Managing a warband between battles, as Wyrdcry's Campaign Book 0.9 has it
 * (step 5 of the aftermath, p. 10): fighters are recruited and equipped in the
 * builder under the same checks as when the warband was first built, and
 * dismissed on the back of their card, their equipment to the stash or with
 * them.
 *
 * `gold` is the whole purse – what the warband is worth together with what it
 * has left – so what leaves the warband's worth leaves the purse with it, and
 * the gold left stays where it was: a dismissed fighter refunds nothing.
 */

import type { Faction, GameSystem, Warband } from './types';
import { activeEffects } from './effects';
import { disbandedAfter, leaderOf } from './leader';
import { purse } from './validate';
import { fighterCost } from './warband';
import { priceOf } from './stash';

/**
 * The warband without the fighter, the pieces at `toStash` – places in its
 * wargear – handed to the stash; disbanded where it was the leader and no
 * fighter is left to take the lead.
 */
export function dismiss(warband: Warband, faction: Faction, game: GameSystem, instanceId: string, toStash: number[]): Warband {
	const instance = warband.fighters.find((f) => f.instanceId === instanceId);
	if (!instance) return warband;
	const kept = instance.wargear.filter((_, i) => toStash.includes(i));
	const leaving = fighterCost(instance, faction, activeEffects(warband, faction)) - kept.reduce((sum, id) => sum + priceOf(id, faction), 0);
	const left: Warband = {
		...warband,
		gold: purse(warband, game) - leaving,
		...(kept.length || warband.stash ? { stash: [...(warband.stash ?? []), ...kept] } : {}),
		fighters: warband.fighters.filter((f) => f !== instance)
	};
	return disbandedAfter(left, faction, game, leaderOf(warband, faction));
}

/**
 * What the warband had already paid for, by fighter: the wargear each carried,
 * as the builder found it. Null before the warband's first battle, while
 * everything is still being put together and comes back at its full price.
 */
export function paidFor(warband: Warband): Map<string, string[]> | null {
	if (!warband.history?.length) return null;
	return new Map(warband.fighters.map((f) => [f.instanceId, [...f.wargear]]));
}
