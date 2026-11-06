/**
 * A campaign's holdings and stronghold in the aftermath, as Black Death City
 * has them (Playtest v1.10, pp. 137–143, 151–152): who takes which holding
 * after the battle, the stronghold's level and upgrade, the income of the
 * stronghold and each holding with the treasure claimed, what is ransacked or
 * turns into another holding, and the downtime's leeching and what the
 * upgrades bring. The dice are rolled at the table; the app is handed the totals.
 */

import type { Faction, GameSystem, Holding, Warband } from './types';

/** What the first step of the aftermath answers about holdings. */
export interface SeizeAnswer {
	/** The prize holding rolled by the winner, by id. */
	prize: string | null;
	/** What the warband did with it: took the prize, seized an enemy holding, stood its ground. Null while unanswered. */
	take: 'prize' | 'enemy' | 'stand' | null;
	/** The enemy holding seized, by id on the table. */
	enemy: string | null;
	/** Its own holdings its opponent seized, by place in its list. */
	lost: number[];
	/** Its own holdings given up to make room, by place in its list. */
	forfeit: number[];
	/** The stronghold upgrade picked where the stronghold gains a level. */
	upgrade: string | null;
}

/**
 * What the income and the downtime answer: totals by source, holdings that
 * turn, d6 tables, counts rolled, fighters leeched. A holding is answered
 * under its `place` from `holdingsAfter`, which stays the same when the
 * seizing changes; an answer whose holding has gone counts for nothing.
 */
export interface CollectAnswer {
	/** Silver by source key: `stronghold`, `holding:<place>`, `treasure`. */
	silver: Record<string, number>;
	/** The holdings, by place, whose income roll turns them. */
	turned: string[];
	/** A d6 table's result, by holding place. */
	tabled: Record<string, number>;
	/** A count rolled for what a holding gives, by `<place>:<wargear>`. */
	counts: Record<string, number>;
	/** For each fighter given a Jar of Canal Leeches, whether the leeching roll took a level of Black Rot. */
	leeched: Record<string, boolean>;
}

export const noSeizing = (): SeizeAnswer => ({ prize: null, take: null, enemy: null, lost: [], forfeit: [], upgrade: null });
export const noCollecting = (): CollectAnswer => ({ silver: {}, turned: [], tabled: {}, counts: {}, leeched: {} });

/** A holding on the game's table, by id. */
export const holdingOf = (game: GameSystem, id: string): Holding | undefined => game.holdings?.table.find((h) => h.id === id);

/** A holding as the first step leaves it: its id, and where it comes from – `own:<place in the warband's list>`, `prize`, `enemy`, `found:<n>`. */
export interface HeldHolding {
	id: string;
	place: string;
}

/**
 * The holdings as the first step leaves them, in order: those kept, then what
 * was taken; with how many must go to make room. `found` are the holdings the
 * search party took after it, last in the list and not counted in `over`: the
 * exploration may not take one the warband has no room for.
 */
export function holdingsAfter(
	warband: Warband,
	game: GameSystem,
	result: 'win' | 'draw' | 'loss' | null,
	seize: SeizeAnswer,
	found: string[] = []
): { held: HeldHolding[]; ids: string[]; over: number } {
	const max = game.holdings?.max ?? 0;
	const kept = (warband.holdings ?? []).flatMap((id, i) => (seize.lost.includes(i) || seize.forfeit.includes(i) ? [] : [{ id, place: `own:${i}` }]));
	const taken =
		result === 'win'
			? seize.take === 'prize' && seize.prize
				? [{ id: seize.prize, place: 'prize' }]
				: seize.take === 'enemy' && seize.enemy
					? [{ id: seize.enemy, place: 'enemy' }]
					: []
			: seize.take === 'prize' && seize.prize
				? [{ id: seize.prize, place: 'prize' }]
				: [];
	const held = [...kept, ...taken, ...found.map((id, n) => ({ id, place: `found:${n}` }))];
	return { held, ids: held.map((h) => h.id), over: Math.max(0, kept.length + taken.length - max) };
}

/** Where the battle that ends now raises the stronghold a level: the level it reaches. */
export function levelGained(warband: Warband, game: GameSystem, counted: boolean): number | null {
	if (!game.holdings || !counted) return null;
	return game.holdings.levelAt((warband.history?.length ?? 0) + 1);
}

export interface IncomeSource {
	key: string;
	label: string;
	/** The roll as the rules print it: `4d6x5`, `d3x5 each`. */
	roll: string;
	kind: 'stronghold' | 'income' | 'ransack' | 'treasure';
	/** The holding's place from `holdingsAfter`, for a holding's income or ransack. */
	place?: string;
	holding?: Holding;
}

/** What step 5 collects: the stronghold, each holding with an income or to ransack, and the treasure claimed in the battle. */
export function incomeOf(warband: Warband, game: GameSystem, faction: Faction, held: HeldHolding[], counted: boolean): IncomeSource[] {
	const rules = game.holdings;
	if (!rules) return [];
	const stronghold = rules.stronghold(warband, faction, (warband.history?.length ?? 0) + (counted ? 1 : 0));
	return [
		...(stronghold ? [{ key: 'stronghold', label: `${stronghold.name}, ${ordinal(stronghold.level)} level`, roll: stronghold.income, kind: 'stronghold' as const }] : []),
		...held.flatMap(({ id, place }): IncomeSource[] => {
			const holding = holdingOf(game, id);
			if (!holding) return [];
			if (holding.ransack) return [{ key: `holding:${place}`, label: `${holding.name}, ransacked`, roll: holding.ransack, kind: 'ransack', place, holding }];
			return holding.income ? [{ key: `holding:${place}`, label: holding.name, roll: holding.income, kind: 'income', place, holding }] : [];
		}),
		...(rules.treasure ? [{ key: 'treasure', label: rules.treasure.label, roll: rules.treasure.roll, kind: 'treasure' as const }] : [])
	];
}

export const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

/** The silver the income brings from the sources there are. */
export const silverOf = (collect: CollectAnswer, sources: IncomeSource[]) => sources.reduce((sum, s) => sum + (collect.silver[s.key] ?? 0), 0);

/**
 * The warband with its holdings, upgrade, income and downtime written in: the
 * holdings as the seizing leaves them, a ransacked one and one its income
 * roll turns replaced or removed after the income; the silver into the purse;
 * what the holdings and the upgrades give into the stash; a Jar of Canal
 * Leeches used up for each fighter leeched, a level of Black Rot gone where
 * the roll took it.
 */
export function applyHoldings(
	warband: Warband,
	game: GameSystem,
	faction: Faction,
	before: Warband,
	result: 'win' | 'draw' | 'loss' | null,
	counted: boolean,
	seize: SeizeAnswer,
	collect: CollectAnswer,
	found: string[] = []
): Warband {
	const rules = game.holdings;
	if (!rules) return warband;
	const { held } = holdingsAfter(before, game, result, seize, found);
	const stash = [...(warband.stash ?? [])];
	const holdings = held.flatMap(({ id, place }): string[] => {
		const holding = holdingOf(game, id);
		if (!holding) return [id];
		for (const give of holding.gives ?? []) {
			const count = typeof give.count === 'number' ? give.count : (collect.counts[`${place}:${give.wargear}`] ?? 0);
			for (let n = 0; n < count; n++) stash.push(give.wargear);
		}
		const tabled = holding.table?.[(collect.tabled[place] ?? 0) - 1];
		if (tabled) stash.push(tabled);
		if (holding.ransack) return [rules.ruined];
		if (holding.turns && collect.turned.includes(place)) return holding.turns.into ? [holding.turns.into] : [];
		return [id];
	});
	const upgrades = [...(warband.upgrades ?? []), ...(seize.upgrade && levelGained(before, game, counted) ? [seize.upgrade] : [])];
	for (const upgrade of rules.upgrades(faction).filter((u) => upgrades.includes(u.id))) {
		for (const give of upgrade.gives ?? []) for (let n = 0; n < give.count; n++) stash.push(give.wargear);
	}
	const leech = rules.leech;
	const leeched = leech ? Object.keys(collect.leeched).filter((id) => warband.fighters.some((f) => f.instanceId === id)) : [];
	for (const _ of leeched) {
		const at = stash.indexOf(leech!.wargear);
		if (at >= 0) stash.splice(at, 1);
	}
	const fighters = warband.fighters.map((f) => {
		if (!leech || !collect.leeched[f.instanceId]) return f;
		const level = f.tally?.[leech.counter] ?? 0;
		return level > 0 ? { ...f, tally: { ...f.tally, [leech.counter]: level - 1 } } : f;
	});
	return {
		...warband,
		gold: (warband.gold ?? 0) + silverOf(collect, incomeOf(before, game, faction, held, counted)),
		...(holdings.length || warband.holdings ? { holdings } : {}),
		...(upgrades.length ? { upgrades } : {}),
		...(stash.length || warband.stash ? { stash } : {}),
		fighters
	};
}

/** How many of the pieces leeching uses the downtime has: those in the stash, and those the income brings. */
export function jarsFor(warband: Warband, game: GameSystem, held: HeldHolding[], collect: CollectAnswer): number {
	const piece = game.holdings?.leech?.wargear;
	if (!piece) return 0;
	const stashed = (warband.stash ?? []).filter((id) => id === piece).length;
	const brought = held.reduce((sum, { id, place }) => {
		const give = holdingOf(game, id)?.gives?.find((g) => g.wargear === piece);
		return sum + (give ? (typeof give.count === 'number' ? give.count : (collect.counts[`${place}:${piece}`] ?? 0)) : 0);
	}, 0);
	return stashed + brought;
}
