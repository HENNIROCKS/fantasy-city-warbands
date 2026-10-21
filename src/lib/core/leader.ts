/**
 * Who leads a warband once its leader is dead or gone, as Wyrdcry's Death of
 * a leader has it (Campaign Book, p. 8): a fighter carrying the game's
 * `succession` keyword takes the LEADER keyword. Only the keyword passes on;
 * the abilities of the leader's own type stay with that type.
 */

import { LEADER, activeEffects } from './effects';
import { chosenOptions, fighterCost } from './warband';
import type { Faction, Fighter, FighterInstance, GameSystem, Warband } from './types';

/** Whether a fighter was recruited as the warband's leader, by its type. */
export function recruitedLeader(instance: FighterInstance, faction: Faction): boolean {
	return faction.fighters.find((f) => f.id === instance.fighterId)?.keywords.includes(LEADER) ?? false;
}

/** Who leads the warband: a fighter that took the lead, else one recruited as its leader that is not dead; null where none does. */
export function leaderOf(warband: Warband, faction: Faction): FighterInstance | null {
	return warband.fighters.find((f) => f.leader) ?? warband.fighters.find((f) => f.away !== 'dead' && recruitedLeader(f, faction)) ?? null;
}

/** The fighter's keywords as it was recruited and as its levels make them, with LEADER where it took the lead. */
export function keywordsOf(instance: FighterInstance, fighter: Fighter, game: GameSystem): string[] {
	const recruited = [...new Set([...fighter.keywords, ...chosenOptions(instance, fighter).flatMap((o) => o.keywords ?? [])])];
	const held = game.advancement ? game.advancement.keywords(instance, recruited) : recruited;
	return instance.leader && !held.includes(LEADER) ? [...held, LEADER] : held;
}

/** Whether the fighter carries what the game asks of a new leader, leaving aside whether the warband needs one. */
export function canLead(instance: FighterInstance, faction: Faction, game: GameSystem): boolean {
	const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
	if (!game.succession || !fighter || instance.away === 'dead') return false;
	return keywordsOf(instance, fighter, game).includes(game.succession.keyword);
}

/**
 * Whether a warband without a leader lost one rather than never recruiting
 * it: it has fought a battle, or keeps its dead leader. A new warband recruits
 * its leader.
 */
export function lostLeader(warband: Warband): boolean {
	return (warband.history?.length ?? 0) > 0 || warband.fighters.some((f) => f.away === 'dead');
}

/** Whether the fighter may take the lead now: the warband lost its leader, and it can lead. */
export function mayLead(warband: Warband, faction: Faction, game: GameSystem, instance: FighterInstance): boolean {
	return !leaderOf(warband, faction) && lostLeader(warband) && canLead(instance, faction, game);
}

/** Whether the warband lost its leader and no fighter can take the lead, so the game has it disbanded. */
export function leaderless(warband: Warband, faction: Faction, game: GameSystem): boolean {
	return !!game.succession && !leaderOf(warband, faction) && lostLeader(warband) && !warband.fighters.some((f) => canLead(f, faction, game));
}

/**
 * The warband marked disbanded where losing `leader` – the one leading it
 * before – leaves no fighter to take the lead; as it was otherwise.
 */
export function disbandedAfter(warband: Warband, faction: Faction, game: GameSystem, leader: FighterInstance | null): Warband {
	return leader && !warband.fighters.some((f) => f.instanceId === leader.instanceId) && leaderless(warband, faction, game)
		? { ...warband, disbanded: true }
		: warband;
}

/** The dead leaders still on the roster, which leave it once another fighter takes the lead. */
export function deadLeaders(warband: Warband, faction: Faction): FighterInstance[] {
	return warband.fighters.filter((f) => f.away === 'dead' && recruitedLeader(f, faction));
}

/**
 * The warband with `instanceId` leading it. A dead leader still on the roster
 * leaves it, its equipment going to the stash where `recovered`. What leaves
 * the warband's worth leaves the purse with it, so the gold left stays where
 * it was.
 */
export function takeLead(warband: Warband, faction: Faction, game: GameSystem, instanceId: string, recovered: boolean): Warband {
	const dead = deadLeaders(warband, faction);
	const effects = activeEffects(warband, faction);
	const stash = [...(warband.stash ?? []), ...(recovered ? dead.flatMap((f) => f.wargear) : [])];
	const kept = (f: FighterInstance) => (recovered ? fighterCost(f, faction, effects) - fighterCost({ ...f, wargear: [] }, faction, effects) : 0);
	const spent = dead.reduce((sum, f) => sum + fighterCost(f, faction, effects) - kept(f), 0);
	return {
		...warband,
		...(spent ? { gold: (warband.gold ?? game.budget) - spent } : {}),
		...(stash.length || warband.stash ? { stash } : {}),
		fighters: warband.fighters.filter((f) => !dead.includes(f)).map((f) => (f.instanceId === instanceId ? { ...f, leader: true as const } : f))
	};
}
