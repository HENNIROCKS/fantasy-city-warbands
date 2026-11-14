/**
 * What a Black Death City warband finds in its campaign rather than buys
 * (Playtest v1.11, pp. 157–170): the curiosities, the relics, and the
 * Legendary Blades of the faction's own table, each blade named and shaped by
 * its two rolled properties. Every faction gets them as wargear never bought,
 * only found; who may carry a piece follows its entry. A stash item is never
 * carried, and a consumable is struck once used.
 */

import type { Rule } from '$lib/core/types';

import curiosities from '$lib/rules/black-death-city/curiosities.json';
import relics from '$lib/rules/black-death-city/relics.json';

/** Who may carry a found piece: any fighter that takes wargear, a Leader or Champion, a fighter with a ranged weapon, a Wizard or Priest, or one that may take the piece named. */
export type Bearer = 'any' | 'leaders' | 'ranged' | 'casters' | 'none' | { wargear: string };

/** A found piece as the faction's wargear rows hold it, with who may carry it. */
export interface FoundRow {
	id: string;
	name: string;
	kind: 'melee' | 'ranged' | 'item';
	cost: number;
	text: string;
	profile?: Record<string, string>;
	traits?: string[];
	held?: boolean;
	effects?: { stat: string; bonus: number }[];
	used?: { bonus: Record<string, number> };
	foundOnly: true;
	singleUse?: true;
	/** A relic sells for its full price, where wargear sells for half (p. 156). */
	sale?: number;
	/** A curiosity sells for the roll its entry prints, such as `2d6x5` (p. 156). */
	saleRoll?: string;
	/** Rules a Legendary Blade's properties give it besides its traits. */
	special?: Rule[];
	bearer: Bearer;
}

interface RawFound {
	id: string;
	name: string;
	kind: string;
	cost: number;
	text: string;
	profile?: Record<string, string>;
	traits?: string[];
	held?: boolean;
	effects?: { stat: string; bonus: number }[];
	used?: { bonus: Record<string, number> };
	stash?: boolean;
	consumable?: boolean;
	who?: string;
}

interface Property {
	roll: number;
	name: string;
	text: string;
	traits?: string[];
	attacks?: number;
	rend?: number;
	damage?: number;
	critical?: number;
	rule?: Rule;
}

const bearerOf = (raw: RawFound): Bearer =>
	raw.stash ? 'none' : raw.who === 'leaders' || raw.who === 'ranged' || raw.who === 'casters' ? raw.who : raw.who ? { wargear: raw.who } : 'any';

/** The silver a curiosity's entry says it is worth – `*Curiosity, Stash Item, 2d6 silver*` – as a roll; none where it is worth a roll for each of its uses. */
const saleRoll = (text: string) => /^\*Curiosity[^*]*?, (\d*d\d+(?:x\d+)?) silver\*/.exec(text)?.[1];

function row(raw: RawFound, relic: boolean): FoundRow {
	return {
		id: raw.id,
		name: raw.name,
		kind: raw.kind as FoundRow['kind'],
		cost: raw.cost,
		text: raw.text,
		...(raw.profile ? { profile: raw.profile } : {}),
		...(raw.traits ? { traits: raw.traits } : {}),
		...(raw.held ? { held: true } : {}),
		...(raw.effects ? { effects: raw.effects } : {}),
		...(raw.used ? { used: raw.used } : {}),
		foundOnly: true,
		...(raw.consumable ? { singleUse: true as const } : {}),
		...(relic && raw.cost ? { sale: raw.cost } : {}),
		...(!relic && saleRoll(raw.text) ? { saleRoll: saleRoll(raw.text) } : {}),
		bearer: bearerOf(raw)
	};
}

/** `-1` one better: `-2`; `–` one better: `-1`. */
const better = (rend: string, by: number) => String((rend === '–' || rend === '-' ? 0 : Number(rend)) - by);
/** `d3+1` one more: `d3+2`; `2` one more: `3`. */
function more(figure: string, by: number): string {
	if (!by) return figure;
	const match = /^(.*?)([+-]\d+)?$/.exec(figure)!;
	if (/^\d+$/.test(figure)) return String(Number(figure) + by);
	const plus = Number(match[2] ?? 0) + by;
	return `${match[1]}${plus ? `+${plus}` : ''}`;
}

/** The id of the Legendary Blade a faction's table makes of two rolls. */
export const bladeId = (prefix: number, suffix: number) => `legendary-blade-${prefix}-${suffix}`;

/** The 36 Legendary Blades of the table a faction rolls on, one for each pair of rolls. */
function blades(faction: string): FoundRow[] {
	const blade = relics.legendaryBlade;
	const table = blade.tables.find((t) => t.factions.includes(faction));
	if (!table) return [];
	return (table.prefixes as Property[]).flatMap((p) =>
		(table.suffixes as Property[]).map((s): FoundRow => {
			const [hit, crit] = blade.profile.damage.split('/');
			const both = [p, s];
			const sum = (key: 'rend' | 'damage' | 'critical') => both.reduce((n, x) => n + (x[key] ?? 0), 0);
			const attacks = both.find((x) => x.attacks)?.attacks;
			return {
				id: bladeId(p.roll, s.roll),
				name: `${p.name} ${s.name}`,
				kind: 'melee',
				cost: blade.cost,
				text: `${blade.text}\n\n${table.name}: ${p.text} ${s.text}`,
				profile: {
					attacks: attacks ? String(attacks) : blade.profile.attacks,
					rend: better(blade.profile.rend, sum('rend')),
					damage: `${more(hit, sum('damage'))}/${more(crit, sum('critical'))}`
				},
				traits: [...new Set([...blade.traits, ...both.flatMap((x) => x.traits ?? [])])],
				special: both.flatMap((x) => (x.rule ? [x.rule] : [])),
				foundOnly: true,
				sale: blade.cost,
				bearer: 'leaders'
			};
		})
	);
}

/** Every piece a faction's warband can find: the curiosities, the relics, and the Legendary Blades of its table. */
export function foundFor(faction: string): FoundRow[] {
	return [...(curiosities.wargear as RawFound[]).map((r) => row(r, false)), ...(relics.wargear as RawFound[]).map((r) => row(r, true)), ...blades(faction)];
}

/** The two find tables, as their entries name the pieces; 64–66 on the Relics table is a Legendary Blade, rolled for twice more. */
export const curiosityTable = curiosities.table;
export const relicTable = relics.table;
/** The table a faction rolls a Legendary Blade's properties on. */
export const bladeTable = (faction: string) => relics.legendaryBlade.tables.find((t) => t.factions.includes(faction)) ?? null;
