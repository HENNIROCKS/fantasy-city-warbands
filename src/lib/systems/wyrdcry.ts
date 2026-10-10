/**
 * Wyrdcry, from the ruleset under `src/lib/rules/wyrdcry/`, which is kept in the
 * same shape as the Wyrdcry Warband Deck's so the two can be compared file by
 * file. Every folder under `factions/` is one faction.
 */

import type { Faction, GameSystem, Wargear } from '$lib/core/types';

import weapons from '$lib/rules/wyrdcry/weapons.json';
import items from '$lib/rules/wyrdcry/items.json';
import weaponRules from '$lib/rules/wyrdcry/weapon-rules.json';
import universal from '$lib/rules/wyrdcry/universal-abilities.json';

export const game: GameSystem = {
	id: 'wyrdcry',
	name: 'Wyrdcry',
	edition: 'v0.9',
	author: 'Johan Markström',
	currency: 'gc',
	currencyName: 'gold coins',
	budget: 1000,
	stats: [
		{ key: 'move', label: 'Move', format: 'inches' },
		{ key: 'fight', label: 'Fight', format: 'plain' },
		{ key: 'shoot', label: 'Shoot', format: 'plain' },
		{ key: 'defense', label: 'Armour', format: 'plain' },
		{ key: 'health', label: 'Health', format: 'plain' },
		{ key: 'bravery', label: 'Bravery', format: 'target' }
	],
	roles: ['leader', 'hero', 'henchman'],
	defaultRole: 'henchman',
	roleLabels: { leader: 'Leader', hero: 'Heroes', henchman: 'Henchmen' },
	groups: [],
	costLabel: 'Gold Crowns',
	weaponStats: [
		{ key: 'range', label: 'Range' },
		{ key: 'attacks', label: 'Attacks' },
		{ key: 'damage', label: 'Damage' }
	],
	universal: universal.map((u) => ({ name: u.name, text: u.text, type: u.type, keyword: u.keyword })),
	/* The rulebook's wording, as the Warband Deck carries it. */
	dualWielding: {
		stat: 'attacks',
		rule: {
			name: 'Dual Wielding',
			text: 'If a fighter is equipped with two melee weapons of the same type (for example, two swords), they are considered to be dual wielding. While a fighter is dual wielding, improve the Attack characteristic of the weapon they are using by 1.'
		}
	}
};

interface RawFaction {
	id: string;
	name: string;
	warband_size: { min: number; max: number | null };
	origin: 'official' | 'homebrew';
	author: string;
}

/** A row of a faction's `equipment.json`: `hero` sells to fighters with that keyword only. */
interface Allowance {
	id: string;
	allow: string;
	restrict?: string;
}

interface RawFighter {
	id: string;
	name: string;
	cost: number;
	limit: { min: number; max: number | null };
	keywords: string[];
	profile: Record<string, number>;
	abilities: string[];
	/** Prefixed `weapon:` or `item:`, like the rows of `equipment.json`. */
	gear: string[];
}

interface RawRule {
	id: string;
	name: string;
	text: string;
	pick: number | null;
	options: { id: string; name: string; text: string }[];
}

interface RawAbility {
	id: string;
	name: string;
	/** What using it costs: `double`, `triple`, `reaction`; `trait` for one that is always on. */
	type: string;
	text: string;
}

const weaponRule = new Map(weaponRules.map((r) => [r.id, { name: r.name, text: r.text }]));

/** A reach of `{ min: 0, max: 1 }` as the card prints it: `1"`, or `4–18"` where it starts further out. */
function range({ min, max }: { min: number; max: number }): string {
	return min ? `${min}–${max}"` : `${max}"`;
}

/**
 * Every weapon and item by its prefixed id, as `equipment.json` names them. An
 * item whose cost is a surcharge on a weapon, such as `"+100"`, has no price of
 * its own and is left out.
 */
const catalogue = new Map<string, Wargear>([
	...weapons.map((w): [string, Wargear] => [
		`weapon:${w.id}`,
		{
			id: `weapon:${w.id}`,
			name: w.name,
			kind: w.type === 'ranged' ? 'ranged' : 'melee',
			cost: w.cost,
			profile: { range: range(w.range), attacks: String(w.attacks), damage: `${w.hit}/${w.crit}` },
			rules: w.rules.flatMap((id) => weaponRule.get(id) ?? [])
		}
	]),
	...items.flatMap((i): [string, Wargear][] =>
		typeof i.cost === 'number'
			? [[`item:${i.id}`, { id: `item:${i.id}`, name: i.name, kind: i.type === 'armour' ? 'armour' : 'item', cost: i.cost, text: i.text }]]
			: []
	)
]);

function build(
	meta: RawFaction,
	fighters: RawFighter[],
	equipment: Allowance[],
	rules: RawRule[],
	abilities: RawAbility[]
): Faction {
	const ability = new Map(abilities.map((a) => [a.id, a]));

	return {
		id: meta.id,
		game: game.id,
		name: meta.name,
		origin: meta.origin,
		author: meta.author,
		/* A rule with a pick is asked for as a choice; the rest is read, not decided. */
		rules: rules.filter((r) => r.pick === null).map((r) => ({ name: r.name, text: r.text })),
		size: meta.warband_size,
		choices: rules
			.filter((r) => r.pick !== null)
			.map((r) => ({ id: r.id, name: r.name, text: r.text, pick: r.pick as number, options: r.options })),
		fighters: fighters.map((f) => ({
			id: f.id,
			name: f.name,
			cost: f.cost,
			limit: f.limit,
			keywords: f.keywords,
			profile: f.profile,
			rules: f.abilities.flatMap((id) => {
				const a = ability.get(id);
				return a ? [{ name: a.name, text: a.text, type: a.type }] : [];
			}),
			wargear: equipment
				.filter((e) => e.allow === 'all' || f.keywords.includes(e.allow))
				.filter((e) => !e.restrict || f.keywords.includes(e.restrict))
				.map((e) => e.id),
			gear: f.gear
		})),
		/* What a fighter carries from the start has to resolve as well as what it can buy. */
		wargear: [...new Set([...equipment.map((e) => e.id), ...fighters.flatMap((f) => f.gear)])].flatMap(
			(id) => catalogue.get(id) ?? []
		)
	};
}

/** Each faction folder's files, keyed by path. */
const files = import.meta.glob('/src/lib/rules/wyrdcry/factions/*/*.json', { eager: true, import: 'default' });

function file<T>(folder: string, name: string): T {
	const data = files[`/src/lib/rules/wyrdcry/factions/${folder}/${name}.json`];
	if (data === undefined) throw new Error(`Wyrdcry faction ${folder} has no ${name}.json`);
	return data as T;
}

const folders = [...new Set(Object.keys(files).map((path) => path.split('/').at(-2)!))];

export const factions: Faction[] = folders.map((folder) =>
	build(
		file<RawFaction>(folder, 'faction'),
		file<RawFighter[]>(folder, 'fighters'),
		file<Allowance[]>(folder, 'equipment'),
		file<RawRule[]>(folder, 'rules'),
		file<RawAbility[]>(folder, 'abilities')
	)
);
