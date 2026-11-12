/**
 * What a warband puts on the battlefield against the game's Deployment Limit
 * (`GameSystem.deployment`): the fighters without a mark that takes them off
 * it, each at what it cost to build.
 */

import { stateOf, type BattleState } from './battle';
import { activeEffects } from './effects';
import type { Faction, GameSystem, Warband } from './types';
import { fighterCost } from './warband';

/** The keys of the marks that take a fighter off the battlefield. */
const offKeys = (game: GameSystem) => (game.battle?.marks ?? []).filter((m) => m.off).map((m) => m.key);

/** What the fighters on the battlefield cost; the whole warband before anybody is marked off it. */
export function fieldedCost(game: GameSystem, warband: Warband, faction: Faction, battle: BattleState | null): number {
	const effects = activeEffects(warband, faction);
	const off = offKeys(game);
	return warband.fighters.filter((f) => !off.some((key) => stateOf(battle, f.instanceId).marks[key])).reduce((sum, f) => sum + fighterCost(f, faction, effects), 0);
}

/**
 * Why the mark cannot be taken off the fighter: it would put the fighter back
 * on the battlefield over the limit. Null for any other mark, any other game
 * and a fighter the mark does not hold.
 */
export function deploymentRefusal(game: GameSystem, warband: Warband, faction: Faction, battle: BattleState | null, instanceId: string, key: string): string | null {
	const limit = game.deployment;
	const instance = warband.fighters.find((f) => f.instanceId === instanceId);
	if (!limit || !instance || !offKeys(game).includes(key) || !stateOf(battle, instanceId).marks[key]) return null;
	const cost = fighterCost(instance, faction, activeEffects(warband, faction));
	return fieldedCost(game, warband, faction, battle) + cost > limit ? `Over the Deployment Limit of ${limit}` : null;
}
