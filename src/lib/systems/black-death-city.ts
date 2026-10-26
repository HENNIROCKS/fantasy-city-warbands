/**
 * Black Death City, from the ruleset under `src/lib/rules/black-death-city/`,
 * transcribed from the Black Death City Playtest v1.03. Every folder under
 * `factions/` is one faction.
 */

import { activeEffects } from '$lib/core/effects';
import type { Faction, Fighter, GameSystem, Rule, Source, StartRoll, Wargear, Warband } from '$lib/core/types';
import { fighterCost } from '$lib/core/warband';

import weaponTraits from '$lib/rules/black-death-city/weapon-traits.json';

export const game: GameSystem = {
	id: 'black-death-city',
	name: 'Black Death City',
	edition: 'Playtest v1.03',
	author: 'Sam Pearson',
	currency: 'silver',
	budget: 1000,
	stats: [
		{ key: 'move', label: 'Move', format: 'inches' },
		{ key: 'blade', label: 'Blade', format: 'target' },
		{ key: 'bow', label: 'Bow', format: 'target' },
		{ key: 'armour', label: 'Armour', format: 'target' },
		{ key: 'initiative', label: 'Initiative', short: 'Init', format: 'plain' },
		{ key: 'willpower', label: 'Willpower', short: 'Will', format: 'plain' },
		{ key: 'life', label: 'Life', format: 'plain' }
	],
	health: 'life',
	/* The playtest names a blank roster but does not print one yet. */
	roster: {
		title: 'Black Death City Warband Roster',
		stats: ['Mv', 'Bl', 'Bw', 'Ar', 'In', 'Wp', 'Lf'],
		weapons: ['Rng', 'Att', 'Rend', 'Dmg'],
		campaign: ['Exp']
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
	upgrade,
	/* Experience and the warband rating are all the playtest counts so far; its
	   campaign chapter is still to come. */
	campaign: {
		warband: [],
		fighter: [{ key: 'experience', label: 'Experience' }],
		start: (fighter, faction) => starts.get(`${faction.id}/${fighter.id}`) ?? null,
		/* The rulebook's Warband Rating, short enough for the card's figures box. */
		values: (warband) => [{ key: 'rating', label: 'Rating', value: String(rating(warband)) }]
	}
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
	/** Names of the faction's wargear lists this fighter buys from. */
	wargear_lists: string[];
	gear: string[];
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
 * weapon is allowed and costs that weapon an attack, which is the card's to show.
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

/**
 * Warbands built under the Playtest v1.01 carry two ids v1.03 no longer has:
 * the Cursed Sword is the Cursed Blade, and the Arablast is the Ogre Arbalest
 * for a fighter offered one and the Arbalest for anyone else and in the stash.
 */
function upgrade(warband: Warband, faction: Faction): Warband {
	const renamed = (id: string, fighter?: Fighter) =>
		id === 'cursed-sword' ? 'cursed-blade' : id === 'arablast' ? (fighter?.wargear.includes('ogre-arbalest') ? 'ogre-arbalest' : 'arbalest') : id;
	const old = (ids: string[]) => ids.some((id) => id === 'cursed-sword' || id === 'arablast');
	if (!warband.fighters.some((f) => old(f.wargear)) && !old(warband.stash ?? [])) return warband;
	return {
		...warband,
		fighters: warband.fighters.map((instance) => {
			const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
			return old(instance.wargear) ? { ...instance, wargear: instance.wargear.map((id) => renamed(id, fighter)) } : instance;
		}),
		...(warband.stash ? { stash: warband.stash.map((id) => renamed(id)) } : {})
	};
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
	origins: RawOrigin[]
): Faction {
	rows.set(meta.id, new Map(wargear.map((w) => [w.id, w])));
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
			rules: [],
			...(f.description ? { fluff: f.description } : {}),
			wargear: [...new Set(f.wargear_lists.flatMap((list) => lists[list] ?? []))],
			gear: f.gear
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
		file<RawOrigin[]>(folder, 'origins')
	)
);
