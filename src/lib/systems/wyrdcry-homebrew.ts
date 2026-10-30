/**
 * The shared lists of Wyrdcry with what the homebrew factions add to them, as
 * the Warband Deck merges them: a homebrew faction may bring a `homebrew.json`
 * with its own weapons, weapon rules and racial limits, an official one may
 * not. The shared files stay what the game prints, and deleting a faction's
 * folder takes its additions with it. An id the shared list holds already is
 * refused, so the game's own entry keeps its profile – except a race the game
 * names without printing its limits, such as the ELF, whose limits a homebrew
 * faction may fill in.
 */

import sharedWeapons from '$lib/rules/wyrdcry/weapons.json';
import sharedWeaponRules from '$lib/rules/wyrdcry/weapon-rules.json';
import sharedLimits from '$lib/rules/wyrdcry/racial-limits.json';

type Weapon = (typeof sharedWeapons)[number];
type WeaponRule = (typeof sharedWeaponRules)[number];
type RacialLimit = (typeof sharedLimits)[number];

interface Homebrew {
	weapons?: Weapon[];
	'weapon-rules'?: WeaponRule[];
	'racial-limits'?: RacialLimit[];
}

const metas = import.meta.glob('/src/lib/rules/wyrdcry/factions/*/faction.json', { eager: true, import: 'default' }) as Record<
	string,
	{ origin: 'official' | 'homebrew' }
>;
const files = import.meta.glob('/src/lib/rules/wyrdcry/factions/*/homebrew.json', { eager: true, import: 'default' }) as Record<string, Homebrew>;

const additions = Object.entries(files).flatMap(([path, homebrew]) => {
	const origin = metas[path.replace(/homebrew\.json$/, 'faction.json')]?.origin;
	if (origin === 'homebrew') return [homebrew];
	if (import.meta.env.DEV) console.warn(`${path}: only a homebrew faction may bring a homebrew.json`);
	return [];
});

/** The shared entries, then each addition whose id is not taken yet. */
function merged<T extends { id: string }>(shared: T[], added: T[], what: string): T[] {
	const ids = new Set(shared.map((entry) => entry.id));
	return [
		...shared,
		...added.filter((entry) => {
			const taken = ids.has(entry.id);
			if (taken && import.meta.env.DEV) console.warn(`homebrew ${what} "${entry.id}" is a shared one already`);
			ids.add(entry.id);
			return !taken;
		})
	];
}

export const weapons = merged(sharedWeapons, additions.flatMap((h) => h.weapons ?? []), 'weapon');
export const weaponRules = merged(sharedWeaponRules, additions.flatMap((h) => h['weapon-rules'] ?? []), 'weapon rule');
const addedLimits = additions.flatMap((h) => h['racial-limits'] ?? []);
const filledLimits = sharedLimits.map((limit) => (limit.profile ? limit : (addedLimits.find((added) => added.id === limit.id && added.profile) ?? limit)));
export const racialLimits = merged(filledLimits, addedLimits.filter((added) => !filledLimits.includes(added)), 'racial limit');
