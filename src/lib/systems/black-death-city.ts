/**
 * Black Death City, from the ruleset under `src/lib/rules/black-death-city/`,
 * transcribed from the Black Death City Playtest v1.01. Every folder under
 * `factions/` is one faction.
 */

import type { Faction, GameSystem, Wargear } from '$lib/core/types';

export const game: GameSystem = {
	id: 'black-death-city',
	name: 'Black Death City',
	edition: 'Playtest v1.01',
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
	roles: ['leader', 'champion', 'henchman', 'brute', 'beast'],
	groups: [
		{ keyword: 'leader', label: 'Leaders', limit: { min: 1, max: 1 } },
		{ keyword: 'champion', label: 'Champions', limit: { min: 0, max: 3 } },
		{ keyword: 'henchman', label: 'Henchmen', limit: { min: 5, max: null } },
		{ keyword: 'brute', label: 'Brutes', limit: { min: 0, max: 2 } },
		{ keyword: 'beast', label: 'Beasts', limit: { min: 0, max: 3 } }
	]
};

/** The rulebook's limit for every faction; the group minimums set the smallest warband. */
const SIZE = { min: 0, max: 15 };

interface RawFaction {
	id: string;
	name: string;
	origin: 'official' | 'homebrew';
	author: string;
}

interface RawFighter {
	id: string;
	name: string;
	cost: number;
	limit: { min: number; max: number | null };
	keywords: string[];
	profile: Record<string, number | string | null>;
	/** Names of the faction's wargear lists this fighter buys from. */
	wargear_lists: string[];
	gear: string[];
}

interface RawOrigin {
	id: string;
	name: string;
	text: string;
	leader: string;
	limits?: { fighter: string; limit: { min: number; max: number | null } }[];
	ungrouped?: string[];
}

function build(
	meta: RawFaction,
	fighters: RawFighter[],
	wargear: Wargear[],
	lists: Record<string, string[]>,
	origins: RawOrigin[]
): Faction {
	return {
		id: meta.id,
		game: game.id,
		name: meta.name,
		origin: meta.origin,
		author: meta.author,
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
			wargear: [...new Set(f.wargear_lists.flatMap((list) => lists[list] ?? []))],
			gear: f.gear
		})),
		wargear
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
		file<Wargear[]>(folder, 'wargear'),
		file<Record<string, string[]>>(folder, 'wargear-lists'),
		file<RawOrigin[]>(folder, 'origins')
	)
);
