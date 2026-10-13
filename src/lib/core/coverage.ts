/**
 * How much of a game the app carries, as a rough count of areas rather than a
 * measure of how deep each one goes. Every area is read off what the game's
 * system brings, so the count follows the code without being kept by hand.
 */

import type { Faction, GameSystem } from './types';

interface Area {
	label: string;
	built: (game: GameSystem, factions: Faction[]) => boolean;
}

const fighters = (factions: Faction[]) => factions.flatMap((f) => f.fighters);

/** In the order the About page lists them. */
export const areas: Area[] = [
	{ label: 'Building a warband', built: (_, factions) => factions.length > 0 },
	{ label: 'What a fighter may carry', built: (game) => !!game.carry },
	{ label: "The fighters' special rules as text", built: (_, factions) => fighters(factions).some((f) => f.rules.length > 0) },
	{ label: 'Choices on recruitment', built: (_, factions) => fighters(factions).some((f) => !!f.choice) },
	/* Counting damage, states and rounds is the core's; `game.battle` only adds a game's own states. */
	{ label: 'Tracking a battle', built: () => true },
	{ label: 'The aftermath of a battle', built: (game) => !!game.aftermath },
	{ label: 'Advancement', built: (game) => !!game.advancement },
	/* The system has no field to read for these, so they count as open for every game. */
	{ label: 'The stash and the trading post', built: () => false },
	{ label: 'Injuries', built: () => false }
];

/** Which of the areas the game has, in the order of `areas`. */
export function coverage(game: GameSystem, factions: Faction[]): boolean[] {
	return areas.map((a) => a.built(game, factions));
}
