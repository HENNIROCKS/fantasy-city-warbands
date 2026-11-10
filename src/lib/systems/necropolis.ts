/**
 * Necropolis, from the ruleset under `src/lib/rules/necropolis/`, transcribed
 * from the Necropolis Rulebook v0.9. Every folder under `factions/` is one
 * Covenant, Wretched Undead among them; all draw on the one list of leaders and
 * minions in `fighters.json` and the one list of armaments in `wargear.json`,
 * as far as the Covenant and the model allow.
 */

import type { Faction, Fighter, GameSystem, Rule, Source, Wargear } from '$lib/core/types';

import fighterData from '$lib/rules/necropolis/fighters.json';
import wargearData from '$lib/rules/necropolis/wargear.json';
import wargearLists from '$lib/rules/necropolis/wargear-lists.json';

/** A slip in the data, where an expression needs a value. */
function fail(message: string): never {
	throw new Error(message);
}

/**
 * A `wargear.json` row. `special` is the weapon's printed Special, `slot` the
 * place a piece takes where it is not a weapon or a set of armour: a shield,
 * or Miscellaneous Equipment, whose Wardart and Throwing Axe are weapons too.
 */
interface RawWargear extends Omit<Wargear, 'rules'> {
	special?: string;
	slot?: 'shield' | 'misc';
}

const rows = new Map((wargearData as RawWargear[]).map((w) => [w.id, w]));

/** The shared form of a row: its Special is its rule. */
function wargearOf({ special, slot: _slot, ...w }: RawWargear): Wargear {
	return { ...w, ...(special ? { rules: [{ name: 'Special', text: special }] } : {}) };
}

const piece = (id: string) => wargearOf(rows.get(id) ?? fail(`Necropolis wargear ${id} does not exist`));

/* A model with no melee weapon fights with an Improvised Weapon; a colossal
   one with the Colossal Improvised Weapon (pp. 36, 38). */
const IMPROVISED = 'improvised-weapon';
const COLOSSAL_IMPROVISED = 'colossal-improvised-weapon';

export const game: GameSystem = {
	id: 'necropolis',
	name: 'Necropolis',
	logo: 'logo-necropolis.svg',
	edition: 'Rulebook v0.9',
	author: 'Peter Vigors',
	currency: 'obols',
	moneyLabel: 'Obols',
	budget: 300,
	stats: [
		{ key: 'ap', label: 'AP', format: 'plain' },
		{ key: 'move', label: 'M', format: 'inches' },
		{ key: 'violence', label: 'Violence', format: 'target' },
		{ key: 'ranged', label: 'Ranged', format: 'target' },
		{ key: 'hp', label: 'HP', format: 'plain' }
	],
	health: 'hp',
	roster: {
		title: 'Necropolis Gathering Roster',
		stats: ['AP', 'M', 'Vi', 'Ra', 'HP'],
		weapons: ['Rng', 'Atk', 'Gl', 'Hit', 'H'],
		split: 'damage'
	},
	roles: ['leader', 'minion'],
	groups: [
		{ keyword: 'leader', label: 'Leaders', limit: { min: 1, max: 1 } },
		{ keyword: 'minion', label: 'Minions', limit: { min: 0, max: null } }
	],
	costLabel: 'Obols',
	/* Damage carries the damage of a glance and of a hit behind a slash (p. 36);
	   Hands is how many hands the weapon takes. */
	weaponStats: [
		{ key: 'range', label: 'Range' },
		{ key: 'attacks', label: 'Attacks' },
		{ key: 'damage', label: 'Damage' },
		{ key: 'hands', label: 'Hands' }
	],
	universal: [],
	unarmed: {
		weapon: piece(IMPROVISED),
		except: [],
		instead: [{ keyword: 'colossal', weapon: piece(COLOSSAL_IMPROVISED) }]
	},
	carry: (fighter, _faction, wargear) => {
		const limit = fighter.keywords.includes('leader') ? 2 : 1;
		const known = (ids: string[]) => ids.flatMap((id) => rows.get(id) ?? []);
		return wargear.flatMap((id, i) => {
			const w = rows.get(id);
			const refused = w && refuse(known([...fighter.gear, ...wargear.slice(0, i)]), w, limit);
			return refused ? [{ message: `${w.name}: ${refused.message}.`, short: refused.short }] : [];
		});
	}
};

/*
 * What a model may carry (pp. 36, 40, 41): 2 weapons for a leader and 1 for a
 * minion, 1 type of armour, 1 shield, which goes with no weapon that takes 2
 * hands, and 1 piece of Miscellaneous Equipment, a Wardart or a Throwing Axe
 * included.
 */
type Slot = 'weapon' | 'armour' | 'shield' | 'misc';

function slotOf(w: RawWargear): Slot {
	return w.slot ?? (w.kind === 'armour' ? 'armour' : w.kind === 'item' ? 'misc' : 'weapon');
}

const twoHanded = (w: RawWargear) => slotOf(w) === 'weapon' && w.profile?.hands === '2';

const SHIELD_MESSAGE = 'A shield can only be used if the model isn’t using a weapon that requires 2 hands';

/** Why the model cannot take `w` beside what it already holds, or null when it can. */
function refuse(held: RawWargear[], w: RawWargear, weapons: number): { message: string; short: string } | null {
	const slot = slotOf(w);
	const full = held.filter((h) => slotOf(h) === slot).length >= (slot === 'weapon' ? weapons : 1);
	if (full) {
		return slot === 'weapon'
			? { message: weapons > 1 ? 'A leader may only have 2 weapons' : 'A minion may only have 1 weapon', short: 'No weapon slot free' }
			: slot === 'armour'
				? { message: 'A model may only have 1 type of armour', short: 'Already wearing armour' }
				: slot === 'shield'
					? { message: 'A model may only have 1 shield', short: 'Already carrying a shield' }
					: { message: 'Each model may only have 1 piece of Miscellaneous Equipment', short: 'Already has one' };
	}
	if (slot === 'shield' && held.some(twoHanded)) return { message: SHIELD_MESSAGE, short: 'Not with a 2h weapon' };
	if (twoHanded(w) && held.some((h) => slotOf(h) === 'shield')) return { message: SHIELD_MESSAGE, short: 'Not with a shield' };
	return null;
}

interface RawFaction {
	id: string;
	name: string;
	origin: 'official';
	author: string;
	source?: Source;
	/** A model joins only with one of these keywords, carried or to choose; any where missing. */
	models?: string[];
	/** The leaders the Covenant allows, by fighter id; any where missing. */
	leaders?: string[];
	/** The Covenant's restriction and its traits, as printed. */
	rules: Faction['rules'];
}

interface RawFighter {
	id: string;
	name: string;
	/** The line under the name, shown as the fighter's fluff. */
	description: string;
	cost: number;
	limit: { min: number; max: number | null };
	keywords: string[];
	/** Blood, Bone or Plasm, as many of them as the model may choose from. */
	affinities: string[];
	profile: Record<string, number | null>;
	/** The armaments lists it may take from, by name in `wargear-lists.json`. */
	wargear_lists: string[];
	/** Pieces it may take beside its lists. */
	wargear_also?: string[];
	/** Pieces of its lists it may not take. */
	wargear_except?: string[];
	rules: Rule[];
}

const roster = fighterData as RawFighter[];

/** The ids of the armaments a fighter is offered; a name or id that does not exist is a slip in the data. */
function offered(f: RawFighter): string[] {
	const lists = wargearLists as Record<string, string[]>;
	const ids = new Set(f.wargear_lists.flatMap((name) => lists[name] ?? fail(`Necropolis ${f.id}: no wargear list ${name}`)));
	for (const id of f.wargear_also ?? []) ids.add(id);
	for (const id of f.wargear_except ?? []) {
		if (!ids.delete(id)) fail(`Necropolis ${f.id}: ${id} is no part of its wargear, so it cannot be left out`);
	}
	for (const id of ids) if (!rows.has(id)) fail(`Necropolis ${f.id}: wargear ${id} does not exist`);
	return [...ids];
}

/** Whether a Covenant takes the model. */
function allows(meta: RawFaction, f: RawFighter): boolean {
	if (meta.models && !meta.models.some((k) => f.keywords.includes(k) || f.affinities.includes(k))) return false;
	return !meta.leaders || !f.keywords.includes('leader') || meta.leaders.includes(f.id);
}

function fighter(f: RawFighter): Fighter {
	const { description, affinities: _affinities, wargear_lists: _lists, wargear_also: _also, wargear_except: _except, ...rest } = f;
	return { ...rest, fluff: description, wargear: offered(f), gear: [] };
}

/** Every Covenant has the same armaments; the Improvised Weapons are no purchase. */
const armaments: Wargear[] = [...rows.values()].filter((w) => w.id !== IMPROVISED && w.id !== COLOSSAL_IMPROVISED).map(wargearOf);

/** Each faction folder's files, keyed by path. */
const files = import.meta.glob('/src/lib/rules/necropolis/factions/*/faction.json', { eager: true, import: 'default' });

export const factions: Faction[] = Object.values(files).map((data) => {
	const { models: _models, leaders: _leaders, ...meta } = data as RawFaction;
	return {
		...meta,
		game: game.id,
		size: { min: 1, max: null },
		choices: [],
		fighters: roster.filter((f) => allows(data as RawFaction, f)).map(fighter),
		wargear: armaments
	};
});
