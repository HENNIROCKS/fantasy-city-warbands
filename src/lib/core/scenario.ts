/**
 * The scenario a battle is fought to and its twist, where the game rolls for
 * them before each battle (`GameSystem.scenarios`). The dice are rolled at the
 * table and the results tapped; both are kept with the battle.
 */

import { start, type BattleState } from './battle';
import type { GameSystem, Scenario, Twist } from './types';

/** The scenario picked for the battle and its twist; null where none is picked or the game has none. */
export function scenarioOf(game: GameSystem, battle: BattleState | null): { scenario: Scenario; twist: Twist | null } | null {
	const picked = battle?.scenario;
	const scenario = picked && game.scenarios?.list.find((s) => s.id === picked.id);
	if (!picked || !scenario) return null;
	return { scenario, twist: scenario.twists.find((t) => t.roll === picked.twist) ?? null };
}

/**
 * The battle with the scenario picked, starting it if none is running, as
 * hiring does; another scenario drops the twist, which belongs to the one
 * before. Null takes the scenario back.
 */
export function setScenario(battle: BattleState | null, id: string | null): BattleState | null {
	if (id === null) {
		if (!battle?.scenario) return battle;
		const { scenario: _picked, ...rest } = battle;
		return rest;
	}
	const current = battle ?? start();
	if (current.scenario?.id === id) return current;
	return { ...current, scenario: { id, twist: null } };
}

/** The battle with the twist picked by its roll, or taken back with null; only once a scenario is picked. */
export function setTwist(battle: BattleState | null, roll: number | null): BattleState | null {
	if (!battle?.scenario) return battle;
	return { ...battle, scenario: { ...battle.scenario, twist: roll } };
}
