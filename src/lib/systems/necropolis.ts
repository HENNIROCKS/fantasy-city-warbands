/**
 * Necropolis, from the ruleset under `src/lib/rules/necropolis/`, transcribed
 * from the Necropolis Rulebook v0.9. Every folder under `factions/` is one
 * Covenant, Wretched Undead among them.
 */

import type { Faction, GameSystem, Source } from '$lib/core/types';

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
		weapons: []
	},
	roles: ['leader', 'minion', 'beast'],
	groups: [{ keyword: 'leader', label: 'Leaders', limit: { min: 1, max: 1 } }],
	costLabel: 'Obols',
	weaponStats: [],
	universal: []
};

interface RawFaction {
	id: string;
	name: string;
	origin: 'official';
	author: string;
	source?: Source;
	/** The Covenant's restriction and its traits, as printed. */
	rules: Faction['rules'];
}

/** Each faction folder's files, keyed by path. */
const files = import.meta.glob('/src/lib/rules/necropolis/factions/*/faction.json', { eager: true, import: 'default' });

export const factions: Faction[] = Object.values(files).map((data) => ({
	...(data as RawFaction),
	game: game.id,
	size: { min: 1, max: null },
	choices: [],
	fighters: [],
	wargear: []
}));
