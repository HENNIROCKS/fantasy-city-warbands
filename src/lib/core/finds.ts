/**
 * Looking for a piece marked `found` between battles, as Wyrdcry's rarity
 * roll has it (Campaign Book, p. 27): a fighter carrying the game's `rarity`
 * keyword searches, others carrying it help, and each of them does so once
 * until the next battle. The roll is made at the table; the app keeps who
 * searched and what was found, and how many copies of it are still to buy.
 *
 * A warband that has not fought sets out with common pieces only (p. 6), so a
 * piece marked `found` is none of its own yet.
 */

import { keywordsOf } from './leader';
import type { Faction, FighterInstance, Finds, GameSystem, Issue, Warband } from './types';

/** The searches since the warband's last battle; none before its first or once another is written down. */
export function findsOf(warband: Warband): Finds | null {
	const last = warband.history?.at(-1)?.id;
	if (!last) return null;
	return warband.finds?.after === last ? warband.finds : { after: last, searched: [], found: [] };
}

/** Who may still search or help: a fighter with the game's keyword, neither dead nor captured, that has not searched since the battle. */
export function searchers(warband: Warband, faction: Faction, game: GameSystem): FighterInstance[] {
	const finds = findsOf(warband);
	if (!game.rarity || !finds) return [];
	const keyword = game.rarity.keyword;
	return warband.fighters.filter((f) => {
		const fighter = faction.fighters.find((t) => t.id === f.fighterId);
		if (!fighter || f.away === 'dead' || f.away === 'captured' || finds.searched.includes(f.instanceId)) return false;
		return keywordsOf(f, fighter, game).includes(keyword);
	});
}

/** The score a search needs with `helpers` helping; a 1 always fails, so never below 2. */
export function targetOf(game: GameSystem, helpers: number): number {
	if (!game.rarity) return 0;
	return Math.max(2, game.rarity.target - helpers * game.rarity.helper);
}

/** How many copies of the piece the warband holds, on its fighters and in the stash. */
export function heldOf(warband: Warband, id: string): number {
	return [...warband.fighters.flatMap((f) => f.wargear), ...(warband.stash ?? [])].filter((w) => w === id).length;
}

/** How many found copies of the piece are still to buy; null where it was not found since the battle. */
export function leftOf(warband: Warband, id: string): number | null {
	const found = findsOf(warband)?.found.find((f) => f.id === id);
	return found ? Math.max(0, found.had + found.copies - heldOf(warband, id)) : null;
}

/**
 * The warband after a search for `id`: those who searched and helped marked,
 * and – where `copies` is above none – the piece found in that many copies,
 * added to what an earlier find left.
 */
export function search(warband: Warband, id: string, searched: string[], copies: number): Warband {
	const finds = findsOf(warband);
	if (!finds) return warband;
	const earlier = finds.found.find((f) => f.id === id);
	const found = copies
		? [
				...finds.found.filter((f) => f !== earlier),
				earlier
					? { ...earlier, copies: earlier.copies + copies }
					: { id, copies, had: heldOf(warband, id) }
			]
		: finds.found;
	return { ...warband, finds: { after: finds.after, searched: [...finds.searched, ...searched], found } };
}

/** What the warband holds of pieces marked `found` beyond what it may: any before its first battle, more than was found since. */
export function findIssues(warband: Warband, game: GameSystem, faction: Faction): Issue[] {
	if (!game.rarity) return [];
	const finds = findsOf(warband);
	const issues: Issue[] = [];
	for (const wargear of faction.wargear) {
		if (!wargear.found) continue;
		if (!finds) {
			for (const instance of warband.fighters.filter((f) => f.wargear.includes(wargear.id))) {
				issues.push({
					code: 'wargear-unfound',
					kind: 'excess',
					message: `${wargear.name} is rare: a warband sets out with common pieces only.`,
					short: 'Rare – after the first battle',
					instanceId: instance.instanceId
				});
			}
			if (warband.stash?.includes(wargear.id)) {
				issues.push({
					code: 'wargear-unfound',
					kind: 'excess',
					message: `${wargear.name} is rare: a warband sets out with common pieces only.`,
					short: 'Rare – after the first battle'
				});
			}
			continue;
		}
		const found = finds.found.find((f) => f.id === wargear.id);
		if (found && heldOf(warband, wargear.id) > found.had + found.copies) {
			issues.push({
				code: 'wargear-unfound',
				kind: 'excess',
				message: `${wargear.name}: ${found.copies} found since the last battle, more bought.`,
				short: 'None found left'
			});
		}
	}
	return issues;
}
