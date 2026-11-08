/**
 * Necropolis, from the ruleset under `src/lib/rules/necropolis/`, transcribed
 * from the Necropolis Rulebook v0.9. Every folder under `factions/` is one
 * Covenant, Wretched Undead among them; all draw on the one list of leaders and
 * minions in `fighters.json`, as far as the Covenant allows.
 */

import type { Faction, Fighter, GameSystem, Rule, Source } from '$lib/core/types';

import fighterData from '$lib/rules/necropolis/fighters.json';

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
	roles: ['leader', 'minion'],
	groups: [
		{ keyword: 'leader', label: 'Leaders', limit: { min: 1, max: 1 } },
		{ keyword: 'minion', label: 'Minions', limit: { min: 0, max: null } }
	],
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
	rules: Rule[];
}

const roster = fighterData as RawFighter[];

/** Whether a Covenant takes the model. */
function allows(meta: RawFaction, f: RawFighter): boolean {
	if (meta.models && !meta.models.some((k) => f.keywords.includes(k) || f.affinities.includes(k))) return false;
	return !meta.leaders || !f.keywords.includes('leader') || meta.leaders.includes(f.id);
}

function fighter({ description, affinities: _affinities, ...f }: RawFighter): Fighter {
	return { ...f, fluff: description, wargear: [], gear: [] };
}

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
		wargear: []
	};
});
