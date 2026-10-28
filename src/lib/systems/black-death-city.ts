/**
 * Black Death City, from the ruleset under `src/lib/rules/black-death-city/`,
 * transcribed from the Black Death City Playtest v1.03. Every folder under
 * `factions/` is one faction.
 */

import { activeEffects } from '$lib/core/effects';
import type { BattleRoll, Faction, Fighter, FighterChoice, GameSystem, Rule, Scenario, Source, StartRoll, Wargear, Warband, WeaponAdjustment } from '$lib/core/types';
import { fighterCost } from '$lib/core/warband';

import weaponTraits from '$lib/rules/black-death-city/weapon-traits.json';
import veteranSkills from '$lib/rules/black-death-city/skills.json';
import scenarios from '$lib/rules/black-death-city/scenarios.json';

export const game: GameSystem = {
	id: 'black-death-city',
	name: 'Black Death City',
	logo: 'logo-bdc.svg',
	edition: 'Playtest v1.03',
	author: 'Sam Pearson',
	currency: 'silver',
	budget: 1000,
	stats: [
		{ key: 'move', label: 'Move', format: 'inches' },
		{ key: 'blade', label: 'Blade', format: 'target' },
		{ key: 'bow', label: 'Bow', format: 'target' },
		/* Armour cannot be improved past 2+. */
		{ key: 'armour', label: 'Armour', format: 'target', floor: 2 },
		{ key: 'initiative', label: 'Initiative', short: 'Init', format: 'plain' },
		{ key: 'willpower', label: 'Willpower', short: 'Will', format: 'plain' },
		{ key: 'life', label: 'Life', format: 'plain' }
	],
	health: 'life',
	/* The fields of the playtest's roster sheet (pp. 136–141 of the high-res
	   file): damage and its critical apart, the weapons' traits, Black Rot to
	   tick, the origin, and the holdings and canal leeches to fill in by hand
	   until the app keeps a campaign. */
	roster: {
		title: 'Black Death City Warband Roster',
		stats: ['Mv', 'Bl', 'Bw', 'Ar', 'In', 'Wl', 'Lf'],
		weapons: ['Rng', 'Atk', 'Rnd', 'Dmg', 'Crit'],
		campaign: ['Exp'],
		split: 'damage',
		traits: true,
		marks: { label: 'Black Rot', count: 3 },
		figures: [
			{ label: 'Battles', value: (w) => String(w.history?.length ?? 0) },
			{ label: 'Won', value: (w) => String(w.history?.filter((h) => h.result === 'win').length ?? 0) },
			{ label: 'Fighters lost', value: (w) => String(w.fighters.filter((f) => f.away === 'dead').length) },
			{ label: 'Holdings ransacked', value: () => '' }
		],
		blanks: [
			{ label: 'Jars of Canal Leeches', withStash: true },
			{ label: 'Holdings', slots: ['Stronghold', '1', '2', '3', '4', '5'] }
		],
		choices: true
	},
	roles: ['leader', 'champion', 'henchman', 'brute', 'beast'],
	groups: [
		{ keyword: 'leader', label: 'Leaders', limit: { min: 1, max: 1 } },
		{ keyword: 'champion', label: 'Champions', limit: { min: 0, max: 3 } },
		{ keyword: 'henchman', label: 'Henchmen', limit: { min: 5, max: null } },
		{ keyword: 'brute', label: 'Brutes', limit: { min: 0, max: 2 } },
		{ keyword: 'beast', label: 'Beasts', limit: { min: 0, max: 3 } }
	],
	costLabel: 'Silver',
	/* Damage carries the critical damage behind a slash, as Wyrdcry's does: `1/d6`. */
	weaponStats: [
		{ key: 'range', label: 'Range' },
		{ key: 'attacks', label: 'Attacks' },
		{ key: 'rend', label: 'Rend' },
		{ key: 'damage', label: 'Damage' }
	],
	universal: [],
	carry,
	weaponAdjustments: adjust,
	/* Experience and the warband rating are all the playtest counts so far; its
	   campaign chapter is still to come. */
	campaign: {
		warband: [],
		fighter: [{ key: 'experience', label: 'Experience' }],
		start: (fighter, faction) => starts.get(`${faction.id}/${fighter.id}`) ?? null,
		/* The rulebook's Warband Rating, short enough for the card's figures box. */
		values: (warband) => [{ key: 'rating', label: 'Rating', value: String(rating(warband)) }]
	},
	battle: {
		waiting: false,
		marks: [],
		/* With 1 point of life left a fighter is bloodied: it makes a move or an
		   action in its activation, not both (p. 11). */
		wounded: { label: 'Bloodied', at: (life) => life - 1 },
		/* Before the battle each caster prepares a spell from each lore it knows (p. 34). */
		rolls: 'Prepared spells',
		/* At the end of each round, 5 or more fighters bloodied or taken down make
		   the warband take a Flee test: on a 1 it flees and the battle ends (p. 18). */
		flee: { label: 'Flee test', breaks: (down) => down >= 5, roll: 'roll a dice', goOn: '2+', end: '1' }
	},
	/* Every battle is fought to one of six scenarios, each with its own twists (pp. 35–48). */
	scenarios: { roll: scenarios.roll, list: scenarios.scenarios as Scenario[] }
};

/** The rulebook's limit for every faction; the group minimums set the smallest warband. */
const SIZE = { min: 0, max: 15 };

interface RawFaction {
	id: string;
	name: string;
	origin: 'official' | 'homebrew';
	author: string;
	source?: Source;
}

interface RawFighter {
	id: string;
	name: string;
	/** The line its Fighter Scroll quotes, marks included. */
	description?: string;
	cost: number;
	/** As the scroll prints it: `40+d6`, `d6`, `0`. */
	starting_experience: string;
	limit: { min: number; max: number | null };
	keywords: string[];
	profile: Record<string, number | string | null>;
	/** Ids of the faction's `abilities.json`: the special rules its scroll prints. */
	abilities: string[];
	/** Names of the faction's wargear lists this fighter buys from. */
	wargear_lists: string[];
	gear: string[];
	/** What it picks on recruitment, one entry per ability that lets it pick. */
	choices?: RawChoice[];
	/** The ids of the spell lores it prepares a spell from before each battle. */
	prepares?: string[];
}

/**
 * A pick on recruitment as `fighters.json` writes it: `source` is the id of
 * the ability it comes out of, whose text is the prompt unless it has its own.
 * The options are its own, or the skill tables named in `skills` – `veteran`
 * for the Veteran Skills – or the spells of the lore named in `lore`.
 */
interface RawChoice extends Omit<FighterChoice, 'source' | 'prompt' | 'options'> {
	source: string;
	prompt?: string;
	options?: FighterChoice['options'];
	skills?: string[];
	lore?: string;
}

/** A skill table (p. 51 and each faction's skills page): who may pick from it, as printed, and its skills. */
interface RawSkillTable {
	id: string;
	name: string;
	who: string;
	skills: { id: string; name: string; text: string }[];
}

/** A spell lore: its spells by the d6 roll that prepares them, each with its keyword, `Attack Spell`. */
interface RawLore {
	id: string;
	name: string;
	spells: { id: string; roll: number; name: string; type: string; text: string }[];
}

/**
 * A faction's `wargear.json` row: traits as ids, a parameter after a colon
 * (`rare:0-1`) – a weapon's, and an item's Rare. `held` marks a Held Item,
 * which takes a melee slot instead of an item slot.
 */
interface RawWargear extends Omit<Wargear, 'rules'> {
	traits?: string[];
	held?: boolean;
}

const trait = new Map(weaponTraits.map((t) => [t.id, t]));

/** `rare:0-1` as the armoury prints it, `Rare 0-1`, with the trait's rule. */
function traitRule(id: string): Rule[] {
	const [key, parameter] = id.split(':');
	const found = trait.get(key);
	return found ? [{ name: parameter ? `${found.name} ${parameter}` : found.name, text: found.text }] : [];
}

/*
 * What a fighter may carry, from the rulebook's Carrying Limit (p. 13), its
 * Held Items box (p. 15) and the Two-handed trait: two melee weapons, one
 * ranged, one set of armour, two items. A Held Item takes a melee slot instead
 * of an item slot. One two-handed weapon at most, melee or ranged. Neither a
 * Held Item nor Full-Plate goes with a two-handed ranged weapon, though
 * Full-Plate does with a Brace of Pistols. A Held Item beside a two-handed melee
 * weapon is allowed and costs that weapon an attack, which `adjust` gives the card.
 * Wargear the scroll says the fighter is equipped with fills its slot too: the
 * Rat-Mutant's claw is one of its two melee weapons.
 */

const SLOTS = { melee: 2, ranged: 1, armour: 1, item: 2 } as const;

/** The raw rows by faction, for what the shared form leaves out. */
const rows = new Map<string, Map<string, RawWargear>>();

type Slot = keyof typeof SLOTS;

function slotOf(w: RawWargear): Slot {
	return w.held ? 'melee' : w.kind;
}

const twoHanded = (w: RawWargear) => !!w.traits?.includes('two-handed');
const twoHandedRanged = (w: RawWargear) => w.kind === 'ranged' && twoHanded(w);
/* Full-Plate goes by the same id in every faction. */
const fullPlate = (w: RawWargear) => w.id === 'full-plate';
const pistols = (w: RawWargear) => w.id === 'brace-of-pistols';

const SLOT_FULL: Record<Slot, string> = {
	melee: 'No melee slot free',
	ranged: 'No ranged slot free',
	armour: 'Already wearing armour',
	item: 'No item slot free'
};

/** Why the fighter cannot take `w` beside what it already holds, or null when it can. */
function refuse(held: RawWargear[], w: RawWargear): { message: string; short: string } | null {
	const slot = slotOf(w);
	if (held.filter((h) => slotOf(h) === slot).length >= SLOTS[slot]) {
		const message =
			slot === 'melee' ? 'A fighter carries up to 2 melee weapons, Held Items included'
			: slot === 'ranged' ? 'A fighter carries 1 ranged weapon'
			: slot === 'armour' ? 'A fighter wears 1 set of armour'
			: 'A fighter carries up to 2 items';
		return { message, short: SLOT_FULL[slot] };
	}
	if (twoHanded(w) && held.some(twoHanded)) {
		return { message: 'A fighter can only be equipped with 1 two-handed weapon', short: 'One two-handed only' };
	}
	if (twoHandedRanged(w)) {
		if (held.some((h) => h.held)) {
			return { message: 'A fighter cannot be equipped with a Held Item and a two-handed ranged weapon', short: 'Not with a Held Item' };
		}
		if (!pistols(w) && held.some(fullPlate)) {
			return { message: 'A fighter in Full-Plate cannot be equipped with two-handed ranged weapons, except a Brace of Pistols', short: 'Not in Full-Plate' };
		}
	}
	if (w.held && held.some(twoHandedRanged)) {
		return { message: 'A fighter cannot be equipped with a Held Item and a two-handed ranged weapon', short: 'Not with two-handed ranged' };
	}
	if (fullPlate(w) && held.some((h) => twoHandedRanged(h) && !pistols(h))) {
		return { message: 'A fighter in Full-Plate cannot be equipped with two-handed ranged weapons, except a Brace of Pistols', short: 'Not with two-handed ranged' };
	}
	return null;
}

/* The Held Items box's wording (p. 15). */
const HELD_TWO_HANDED: WeaponAdjustment = {
	stat: 'attacks',
	amount: -1,
	rule: {
		name: 'Held Item',
		text: "A fighter can be equipped with a held item and a two-handed melee weapon (eg. a Spear and Shield), however, subtract 1 from the Attacks value of the fighter's two-handed melee weapons."
	}
};

/** A two-handed melee weapon beside a Held Item loses an attack. */
function adjust(weapon: Wargear, _count: number, carried: Wargear[], faction: Faction): WeaponAdjustment[] {
	const of = rows.get(faction.id);
	const raw = of?.get(weapon.id);
	if (!raw || raw.kind !== 'melee' || !twoHanded(raw)) return [];
	return carried.some((c) => of!.get(c.id)?.held) ? [HELD_TWO_HANDED] : [];
}

function carry(fighter: Fighter, faction: Faction, wargear: string[]) {
	const of = rows.get(faction.id);
	if (!of) return [];
	const known = (ids: string[]) => ids.flatMap((id) => of.get(id) ?? []);
	return wargear.flatMap((id, i) => {
		const w = of.get(id);
		const refused = w && refuse(known([...fighter.gear, ...wargear.slice(0, i)]), w);
		return refused ? [{ message: `${w.name}: ${refused.message}.`, short: refused.short }] : [];
	});
}

/** A special rule as a scroll prints it; `type` where its name carries one, `[Action]`. */
interface RawAbility {
	id: string;
	name: string;
	type?: string;
	text: string;
}

interface RawOrigin {
	id: string;
	name: string;
	text: string;
	leader: string;
	limits?: { fighter: string; limit: { min: number; max: number | null } }[];
	ungrouped?: string[];
}

/** Each fighter's starting experience, keyed `faction/fighter`; a fighter that starts with none is null. */
const starts = new Map<string, StartRoll | null>();

/** A slip in the data, where an expression needs a value. */
function fail(message: string): never {
	throw new Error(message);
}

/** `40+d6`, `d6` or `0` as the scroll prints it; anything else is a slip in the data. */
function startOf(text: string, where: string): StartRoll | null {
	if (text === '0') return null;
	const match = /^(?:(\d+)\+)?d(\d+)$/.exec(text);
	if (!match) throw new Error(`Black Death City ${where}: starting experience "${text}" is not of the form 40+d6`);
	return { key: 'experience', base: Number(match[1] ?? 0), die: Number(match[2]) };
}

/**
 * The warband rating (p. 50): what every fighter on the roster cost with its
 * wargear, and their experience. The stash and the silver left do not count.
 */
function rating(warband: Warband): number {
	const faction = factions.find((f) => f.id === warband.factionId);
	if (!faction) return 0;
	const effects = activeEffects(warband, faction);
	return warband.fighters
		.filter((f) => f.away !== 'dead')
		.reduce((sum, f) => sum + fighterCost(f, faction, effects) + (f.tally?.experience ?? 0), 0);
}

function build(
	meta: RawFaction,
	fighters: RawFighter[],
	wargear: RawWargear[],
	lists: Record<string, string[]>,
	origins: RawOrigin[],
	abilities: RawAbility[],
	skills: RawSkillTable[],
	lores: RawLore[]
): Faction {
	rows.set(meta.id, new Map(wargear.map((w) => [w.id, w])));
	const ability = new Map(abilities.map((a) => [a.id, a]));
	/* An id the faction's abilities do not hold is a slip in the data. */
	const rulesOf = (f: RawFighter): Rule[] =>
		f.abilities.map((id) => {
			const a = ability.get(id);
			if (!a) throw new Error(`Black Death City ${meta.id}/${f.id}: no ability ${id}`);
			return { name: a.name, text: a.text, ...(a.type ? { type: a.type } : {}) };
		});
	const tables = new Map([...veteranSkills, ...skills].map((t) => [t.id, t]));
	const lore = new Map(lores.map((l) => [l.id, l]));
	/* Skills fall under No Duplicates (p. 51); signature spells do not. An id
	   the faction's tables or lores do not hold is a slip in the data, and so
	   is an option two of a fighter's choices offer, since its picks are one list. */
	const choicesOf = (f: RawFighter): FighterChoice[] => {
		const where = `Black Death City ${meta.id}/${f.id}`;
		const choices = (f.choices ?? []).map(({ source, prompt, options, skills: from, lore: known, ...rest }): FighterChoice => {
			const a = ability.get(source);
			if (!a) throw new Error(`${where}: no ability ${source} for its choice`);
			const base = { ...rest, prompt: prompt ?? a.text, source: a.name };
			if (from) {
				const offered = from.map((id) => tables.get(id) ?? fail(`${where}: no skill table ${id}`));
				const all = offered.flatMap((t) => t.skills.map((s) => ({ ...s, group: t.name })));
				return { ...base, unique: true, noun: { one: 'skill', many: 'skills' }, options: all };
			}
			if (known) {
				const spells = lore.get(known) ?? fail(`${where}: no spell lore ${known}`);
				return { ...base, noun: { one: 'signature spell', many: 'signature spells' }, options: spells.spells.map(({ roll: _roll, ...s }) => s) };
			}
			return { ...base, options: options ?? [] };
		});
		const ids = choices.flatMap((c) => c.options.map((o) => o.id));
		const twice = ids.find((id, i) => ids.indexOf(id) !== i);
		if (twice) throw new Error(`${where}: ${twice} is offered by two of its choices`);
		const lost = choices.flatMap((c) => (c.given ?? []).filter((id) => !c.options.some((o) => o.id === id)));
		if (lost.length) throw new Error(`${where}: given ${lost.join(', ')} is not among its options`);
		return choices;
	};
	/* Before each battle a caster prepares a random spell from each lore it knows (p. 34). */
	const preparesOf = (f: RawFighter): BattleRoll[] =>
		(f.prepares ?? []).map((id) => {
			const known = lore.get(id) ?? fail(`Black Death City ${meta.id}/${f.id}: no spell lore ${id} to prepare from`);
			return { id: known.id, name: known.name, options: known.spells };
		});
	for (const f of fighters) starts.set(`${meta.id}/${f.id}`, startOf(f.starting_experience, `${meta.id}/${f.id}`));
	return {
		id: meta.id,
		game: game.id,
		name: meta.name,
		origin: meta.origin,
		author: meta.author,
		...(meta.source ? { source: meta.source } : {}),
		rules: [],
		size: SIZE,
		choices: [
			{
				id: 'origin',
				name: 'Origin',
				text: 'Before hiring any fighters, pick an origin for your warband.',
				pick: 1,
				options: origins.map((o) => ({
					id: o.id,
					name: o.name,
					text: o.text,
					effect: { leader: o.leader, limits: o.limits, ungrouped: o.ungrouped }
				}))
			}
		],
		fighters: fighters.map((f) => ({
			id: f.id,
			name: f.name,
			cost: f.cost,
			limit: f.limit,
			keywords: f.keywords,
			profile: f.profile,
			rules: rulesOf(f),
			...(f.description ? { fluff: f.description } : {}),
			wargear: [...new Set(f.wargear_lists.flatMap((list) => lists[list] ?? []))],
			gear: f.gear,
			...(f.choices?.length ? { choices: choicesOf(f) } : {}),
			...(f.prepares?.length ? { beforeBattle: preparesOf(f) } : {})
		})),
		/* What only the carrying rules read stays out of the shared form; Rare
		   is a limit every game may have, so it goes in. */
		wargear: wargear.map(({ traits, held: _held, ...w }) => {
			const rare = traits?.find((t) => t.startsWith('rare:'))?.split('-')[1];
			return { ...w, rules: (traits ?? []).flatMap(traitRule), ...(rare ? { rare: Number(rare) } : {}) };
		})
	};
}

/** Each faction folder's files, keyed by path. */
const files = import.meta.glob('/src/lib/rules/black-death-city/factions/*/*.json', { eager: true, import: 'default' });

function file<T>(folder: string, name: string): T {
	const data = files[`/src/lib/rules/black-death-city/factions/${folder}/${name}.json`];
	if (data === undefined) throw new Error(`Black Death City faction ${folder} has no ${name}.json`);
	return data as T;
}

const folders = [...new Set(Object.keys(files).map((path) => path.split('/').at(-2)!))];

export const factions: Faction[] = folders.map((folder) =>
	build(
		file<RawFaction>(folder, 'faction'),
		file<RawFighter[]>(folder, 'fighters'),
		file<RawWargear[]>(folder, 'wargear'),
		file<Record<string, string[]>>(folder, 'wargear-lists'),
		file<RawOrigin[]>(folder, 'origins'),
		file<RawAbility[]>(folder, 'abilities'),
		file<RawSkillTable[]>(folder, 'skills'),
		file<RawLore[]>(folder, 'spells')
	)
);
