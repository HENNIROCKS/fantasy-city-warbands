/**
 * Necropolis, from the ruleset under `src/lib/rules/necropolis/`, transcribed
 * from the Necropolis Rulebook v0.9. Every folder under `factions/` is one
 * Covenant, Wretched Undead among them; all draw on the one list of leaders and
 * minions in `fighters.json`, the one list of armaments in `wargear.json`, of
 * spells in `spells.json` and of Wretched Undead traits in `traits.json`, as far
 * as the Covenant and the model allow.
 */

import type { Faction, Fighter, FighterChoice, GameSystem, Rule, Source, Wargear } from '$lib/core/types';

import fighterData from '$lib/rules/necropolis/fighters.json';
import leaderTraits from '$lib/rules/necropolis/leader-traits.json';
import spells from '$lib/rules/necropolis/spells.json';
import traits from '$lib/rules/necropolis/traits.json';
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

/* Blood, Bone or Plasm (pp. 29–35): a model takes one as its keyword, and a
   Covenant naming some of them in its `models` allows only those. */
const ELEMENTS = ['blood', 'bone', 'plasm'];
const AFFINITY_RULE = 'Blood, Bone or Plasm';
const HEAVY_ARMOUR = 'heavy-armour';

/* What an element adds to the profile, by fighter id; Violence is a roll
   target, so improving it by 1 is −1. A model missing here, or an element
   missing for it, brings only its keyword. */
const RAISED: Record<string, Record<string, Record<string, number>>> = {
	lich: { blood: { hp: 2 }, bone: { violence: -1 }, plasm: { hp: -2 } },
	revenant: { blood: { hp: 2 }, bone: { violence: -1 }, plasm: { hp: -2 } },
	'ascended-undead': { blood: { hp: 2 }, bone: { violence: -1 }, plasm: { hp: -2 } },
	husk: { blood: { hp: 2 }, bone: { violence: -1 }, plasm: { hp: -2 } },
	'aberrant-husk': { blood: { hp: 2 }, bone: { violence: -1 }, plasm: { hp: -2 } },
	'necromantic-remnant': { plasm: { hp: -1 } },
	'small-beast': { plasm: { hp: -2 } },
	'gigantic-horror': { plasm: { hp: -2 } }
};

/** The models that may not wear heavy armour once they are Plasm. */
const PLASM_UNARMOURED = new Set(['lich', 'revenant', 'ascended-undead', 'husk', 'aberrant-husk', 'gigantic-horror']);

export const game: GameSystem = {
	id: 'necropolis',
	name: 'Necropolis',
	logo: 'logo-necropolis.svg',
	edition: 'Rulebook v0.9',
	author: 'Peter Vigors',
	currency: 'obols',
	moneyLabel: 'Obols',
	budget: 300,
	deployment: 350,
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
	/* Gatherings take turns activating single models until all have, with no
	   waiting (p. 7). A model left out of the deployment takes no part in the battle. */
	battle: {
		waiting: false,
		marks: [{ key: 'benched', label: 'Not fielded', lasts: 'battle', off: true }]
	},
	universal: [],
	unarmed: {
		weapon: piece(IMPROVISED),
		except: [],
		instead: [{ keyword: 'colossal', weapon: piece(COLOSSAL_IMPROVISED) }]
	},
	carry: (fighter, _faction, wargear) => {
		const limit = fighter.keywords.includes('leader') ? 2 : 1;
		const unarmoured = fighter.keywords.includes('plasm') && PLASM_UNARMOURED.has(fighter.id);
		const known = (ids: string[]) => ids.flatMap((id) => rows.get(id) ?? []);
		return wargear.flatMap((id, i) => {
			const w = rows.get(id);
			if (w && unarmoured && id === HEAVY_ARMOUR) return [{ message: `${w.name}: A Plasm ${fighter.name} may not wear heavy armour.`, short: 'Not for Plasm' }];
			const refused = w && refuse(known([...fighter.gear, ...wargear.slice(0, i)]), w, limit);
			return refused ? [{ message: `${w.name}: ${refused.message}.`, short: refused.short }] : [];
		});
	}
};

/*
 * What a model may carry (pp. 36, 40, 41): 2 weapons for a leader and 1 for a
 * minion, 1 type of armour, 1 shield, which goes with no weapon that takes 2
 * hands, and 1 piece of Miscellaneous Equipment, a Wardart or a Throwing Axe
 * included. A Plasm leader, Husk or Gigantic Horror wears no heavy armour
 * (pp. 29, 32, 35).
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
	/**
	 * A model joins only with one of these keywords, carried or to choose; any
	 * where missing. Naming Blood, Bone or Plasm, it also limits the model's
	 * choice to those.
	 */
	models?: string[];
	/** The leaders the Covenant allows, by fighter id; any where missing. */
	leaders?: string[];
	/** The schools whose spells a leader may choose; all where missing. */
	schools?: string[];
	/** The trait the Covenant gives its leader. */
	leaderTrait?: RawTrait;
	/** The trait it lets one model of the gathering have, in place of one from the Wretched Undead list. */
	trait?: RawTrait;
	/** The Covenant's restriction, as printed. */
	rules: Faction['rules'];
}

/** A trait, from a `faction.json` or `traits.json`. */
interface RawTrait {
	id: string;
	name: string;
	text: string;
	/** Keywords of which the model must carry one. */
	only?: string[];
	bonus?: Record<string, number>;
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
	/** How many mana points it divides between Blood, Bone and Plasm, for a model that casts. */
	mana?: number;
	/** How many spells it chooses besides Summon, for a model that casts. */
	spells?: number;
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

/** Blood, Bone or Plasm as the model's choice, of those the Covenant allows; one allowed is given. */
function affinityOf(f: RawFighter, elements: string[]): FighterChoice {
	const options = f.affinities
		.filter((a) => elements.includes(a))
		.map((id) => ({
			id,
			name: id[0].toUpperCase() + id.slice(1),
			text: '',
			...(RAISED[f.id]?.[id] ? { bonus: RAISED[f.id][id] } : {}),
			keywords: id === 'plasm' && !f.keywords.includes('fly') ? [id, 'fly'] : [id]
		}));
	if (!options.length) fail(`Necropolis ${f.id}: none of ${elements.join(', ')} to choose`);
	/* Where a rule of the model's own explains the elements, the choice comes out of it. */
	const source = f.rules.some((r) => r.name === AFFINITY_RULE) ? { source: AFFINITY_RULE } : {};
	const shared = { ...source, options, noun: { one: 'keyword', many: 'keywords' } };
	return options.length === 1
		? { ...shared, prompt: 'The Covenant gives the model its keyword.', pick: 0, given: [options[0].id] }
		: { ...shared, prompt: 'Choose Blood, Bone or Plasm as the model’s keyword.', pick: 1 };
}

/** A `spells.json` row. */
interface RawSpell {
	id: string;
	name: string;
	school: string;
	ap: number;
	channel: string;
	text: string;
}

/** Every leader knows Summon (p. 29). */
const SUMMON = 'summon';
const MANA_RULE = 'Mana and spells';

const SCHOOLS = ['Blood', 'Bone', 'Plasm'];

/** The mana points a caster divides between the three schools, each school as often as it likes (p. 29–31). */
function manaOf(f: RawFighter & { mana: number }): FighterChoice {
	return {
		id: 'mana',
		source: MANA_RULE,
		prompt: `Divide ${f.mana} mana ${f.mana === 1 ? 'point' : 'points'} between Blood, Bone and Plasm.`,
		pick: f.mana,
		repeat: true,
		options: SCHOOLS.map((name) => ({ id: `mana-${name.toLowerCase()}`, name, text: '' })),
		noun: { one: 'mana point', many: 'mana points' }
	};
}

/** The spells a caster chooses from the schools it may learn, by school, and the one it knows already. */
function spellsOf(f: RawFighter & { spells: number }, schools: string[] | undefined): FighterChoice {
	const options = (spells as RawSpell[])
		.filter((sp) => !schools || schools.includes(sp.school))
		.map((sp) => ({
			id: sp.id,
			name: sp.name,
			text: `**AP ${sp.ap} · Channel ${sp.channel}** ${sp.text}`,
			group: sp.school[0].toUpperCase() + sp.school.slice(1)
		}));
	if (!options.some((o) => o.id === SUMMON)) fail(`Necropolis ${f.id}: Summon is no spell of ${schools?.join(', ')}`);
	return {
		id: 'spells',
		source: f.rules.some((r) => r.name === MANA_RULE) ? MANA_RULE : undefined,
		prompt: `Choose ${f.spells} ${f.spells === 1 ? 'spell' : 'spells'}; every leader knows Summon.`,
		pick: f.spells,
		given: [SUMMON],
		options,
		noun: { one: 'spell', many: 'spells' }
	};
}

/** The Basic Leader Trait a leader chooses (p. 31). */
function leaderTraitOf(f: RawFighter): FighterChoice {
	return {
		id: 'leader-trait',
		source: f.rules.some((r) => r.name === MANA_RULE) ? MANA_RULE : undefined,
		prompt: 'Choose 1 Basic Leader Trait.',
		pick: 1,
		options: leaderTraits as FighterChoice['options'],
		noun: { one: 'trait', many: 'traits' }
	};
}

/** The trait the Covenant gives the leader on top of the others (p. 19–23). */
function covenantTraitOf(trait: RawTrait): FighterChoice {
	return {
		id: 'covenant-trait',
		prompt: 'The Covenant gives the leader this trait.',
		pick: 0,
		given: [trait.id],
		options: [trait],
		noun: { one: 'trait', many: 'traits' }
	};
}

/**
 * The traits a model may take (p. 17, 19–26): the Covenant's own for one model
 * of the gathering or the Wretched Undead's, which the gathering of a Covenant
 * takes one of and Wretched Undead two. A leader may have two besides its
 * Basic Leader Trait, a minion one.
 */
function traitsOf(f: RawFighter, raw: RawFaction): FighterChoice {
	const across = raw.trait ? 1 : 2;
	return {
		id: 'traits',
		prompt: raw.trait
			? 'One model of the gathering may have the Covenant’s trait or a Wretched Undead trait.'
			: 'The gathering gives two Wretched Undead traits, to one model or two.',
		pick: Math.min(f.keywords.includes('leader') ? 2 : 1, across),
		optional: true,
		across,
		options: [...(raw.trait ? [{ ...raw.trait, group: raw.name }] : []), ...(traits as RawTrait[]).map((t) => ({ ...t, group: 'Wretched Undead' }))],
		noun: { one: 'trait', many: 'traits' }
	};
}

function fighter(f: RawFighter, raw: RawFaction, elements: string[]): Fighter {
	const { description, affinities: _affinities, mana: _mana, spells: _spells, wargear_lists: _lists, wargear_also: _also, wargear_except: _except, ...rest } = f;
	const choices = [affinityOf(f, elements)];
	if (f.mana !== undefined) choices.push(manaOf({ ...f, mana: f.mana }));
	if (f.spells !== undefined) choices.push(spellsOf({ ...f, spells: f.spells }, raw.schools));
	if (f.keywords.includes('leader')) choices.push(leaderTraitOf(f));
	if (f.keywords.includes('leader') && raw.leaderTrait) choices.push(covenantTraitOf(raw.leaderTrait));
	choices.push(traitsOf(f, raw));
	return { ...rest, fluff: description, wargear: offered(f), gear: [], choices };
}

/** Every Covenant has the same armaments; the Improvised Weapons are no purchase. */
const armaments: Wargear[] = [...rows.values()].filter((w) => w.id !== IMPROVISED && w.id !== COLOSSAL_IMPROVISED).map(wargearOf);

/** Each faction folder's files, keyed by path. */
const files = import.meta.glob('/src/lib/rules/necropolis/factions/*/faction.json', { eager: true, import: 'default' });

export const factions: Faction[] = Object.values(files).map((data) => {
	const raw = data as RawFaction;
	const { models: _models, leaders: _leaders, schools: _schools, leaderTrait: _leaderTrait, trait: _trait, ...meta } = raw;
	const named = ELEMENTS.filter((e) => raw.models?.includes(e));
	const elements = named.length ? named : ELEMENTS;
	return {
		...meta,
		game: game.id,
		size: { min: 1, max: null },
		choices: [],
		fighters: roster.filter((f) => allows(raw, f)).map((f) => fighter(f, raw, elements)),
		wargear: armaments
	};
});
