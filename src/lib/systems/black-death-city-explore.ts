/**
 * Black Death City's Explore the City, step 4 of the aftermath (Playtest
 * v1.11, pp. 151–154): the exploration table from `encounters.json`, the
 * Curiosities and Relics tables from the finds, and the exploration re-rolls the
 * warband's rules grant. What the app keeps – silver, a piece into the stash,
 * a roll on a table, a holding, a recruit, what falls on each fighter of the
 * scouting party – becomes a gain; anything else is marked to be noted by hand.
 */

import type { Encounter, Explore, FindAmount, FindGain, FindOption, FindTable, PartyGain, Rule, Warband } from '$lib/core/types';

import data from '$lib/rules/black-death-city/encounters.json';
import curiosities from '$lib/rules/black-death-city/curiosities.json';
import relics from '$lib/rules/black-death-city/relics.json';
import { BLACK_ROT } from './black-death-city-injuries';

/** An action as the data writes it: `{ "gold": "d6x5" }`, `{ "blackRot": 1 }`. */
type RawAction = Record<string, unknown>;

interface RawParty {
	dice: string | null;
	keywords?: string[];
	except?: string[];
	results: { on: string; do: RawAction[] }[];
}

interface RawEncounter {
	roll: string;
	group: string;
	name: string;
	text: string;
	byHand?: boolean;
	who?: NonNullable<Encounter['who']>;
	do?: RawAction[];
	ask?: { label: string; options: { label: string; do: RawAction[]; byHand?: boolean }[] };
}

/** The counter experience is kept in. */
const EXPERIENCE = 'experience';

/** A count as the data writes it – `5`, `"d6x5"`, `"2d6"` – with the values the roll may come to. */
function amount(raw: unknown): FindAmount {
	if (typeof raw === 'number') return raw;
	const match = typeof raw === 'string' ? /^(\d*)d(\d+)(?:x(\d+))?$/.exec(raw) : null;
	if (!match) throw new Error(`Black Death City explore: no count "${String(raw)}"`);
	const dice = Number(match[1] || 1);
	const sides = Number(match[2]);
	const times = Number(match[3] || 1);
	const values = Array.from({ length: dice * (sides - 1) + 1 }, (_, i) => (dice + i) * times);
	return { roll: `${dice > 1 ? dice : ''}D${sides}${times > 1 ? ` × ${times}` : ''}`, values };
}

/** The gains a list of actions brings. */
function gainsOf(actions: RawAction[]): FindGain[] {
	return actions.map((action): FindGain => {
		if ('gold' in action) return { gold: amount(action.gold) };
		if ('table' in action) return { table: String(action.table) };
		if ('blackRot' in action) return { counter: { key: BLACK_ROT, amount: Number(action.blackRot) } };
		if ('experience' in action) return { counter: { key: EXPERIENCE, amount: Number(action.experience) } };
		if ('injury_roll' in action) return { injuryRoll: {} };
		if ('wargear' in action) return { wargear: String(action.wargear) };
		if ('holding' in action) return { holding: { except: (action.holding as { except?: string[] }).except ?? [] } };
		if ('remove' in action) return { remove: true };
		if ('recruit' in action) return { recruit: action.recruit as { keyword: string; below: number; ids?: string[]; free?: boolean } };
		if ('party' in action) {
			const raw = action.party as RawParty;
			const party: PartyGain = {
				dice: raw.dice,
				...(raw.keywords ? { keywords: raw.keywords } : {}),
				...(raw.except ? { except: raw.except } : {}),
				results: raw.results.map((r) => ({ on: r.on, label: r.on, gains: gainsOf(r.do) }))
			};
			return { party };
		}
		throw new Error(`Black Death City explore: no action ${JSON.stringify(action)}`);
	});
}

function encounterOf(raw: RawEncounter): Encounter {
	return {
		roll: raw.roll,
		name: raw.name,
		text: raw.text,
		group: raw.group,
		...(raw.who ? { who: raw.who } : {}),
		gains: gainsOf(raw.do ?? []),
		...(raw.ask
			? {
					ask: {
						label: raw.ask.label,
						options: raw.ask.options.map((o): FindOption => ({ label: o.label, gains: gainsOf(o.do), ...(o.byHand ? { byHand: true } : {}) }))
					}
				}
			: {}),
		...(raw.byHand ? { byHand: true } : {})
	};
}

/** The rolls a printed range such as `21–26` covers; a single roll as it is. */
function rollsOf(range: string): string[] {
	const [from, to] = range.split('–').map(Number);
	return to ? Array.from({ length: to - from + 1 }, (_, i) => String(from + i)) : [range];
}

/**
 * The Curiosities table as it rolls: one row for each roll of the d66, a
 * Jar of Canal Leeches or a Healing Tonic as many as the units of the roll.
 */
function curiosityRows(): FindTable['rows'] {
	const name = new Map(curiosities.wargear.map((w) => [w.id, w]));
	return curiosities.table.flatMap((row) => {
		const piece = name.get(row.wargear)!;
		return rollsOf(row.roll).map((roll) => {
			const copies = 'units' in row ? Number(roll) % 10 : 1;
			return {
				roll,
				name: copies > 1 ? `${piece.name} × ${copies}` : piece.name,
				text: piece.text,
				gains: [{ wargear: piece.id, ...(copies > 1 ? { copies } : {}) }] as FindGain[]
			};
		});
	});
}

/** The Relics table as it prints its rolls; a Legendary Blade is rolled for twice more and added to the stash by hand. */
function relicRows(): FindTable['rows'] {
	const name = new Map(relics.wargear.map((w) => [w.id, w]));
	return relics.table.map((row) => {
		const piece = name.get(row.wargear);
		return piece
			? { roll: row.roll, name: piece.name, text: piece.text, gains: [{ wargear: piece.id }] as FindGain[] }
			: {
					roll: row.roll,
					name: 'Legendary Blade',
					text: relics.legendaryBlade.text.replace(/^\*[^*]*\*\n\n/, '') + ' Roll twice on your faction’s table and add it to the stash on the back of the warband card.',
					gains: [] as FindGain[]
				};
	});
}

const tables: FindTable[] = [
	{ id: 'curiosities', name: 'Curiosities', dice: 'D66', rows: curiosityRows() },
	{ id: 'relics', name: 'Relics', dice: 'D66', rows: relicRows() },
	...data.tables.map((t) => ({ id: t.id, name: t.name, dice: t.dice, rows: t.rows.map((r) => ({ roll: r.roll, name: r.name, text: r.text, gains: gainsOf(r.do) })) }))
];

/** A rule and where it comes from: a fighter, a holding, a piece of wargear. */
export interface SourcedRule {
	source: string;
	rule: Rule;
}

/**
 * `rulesOf`: the rules of the warband that may grant an exploration re-roll –
 * the scouting party's abilities, skills and wargear, the holdings, the
 * stronghold and its upgrades. Each that names an exploration re-roll is
 * listed under the search party as it is printed, for the player to apply
 * to the roll: the dice it is limited to, who must lead, what must have been won.
 */
export function blackDeathCityExplore(rulesOf: (warband: Warband, party: string[]) => SourcedRule[]): Explore {
	return {
		label: 'Explore the City',
		encounters: (data.encounters as RawEncounter[]).map(encounterOf),
		tables,
		/* "1 Leader or Champion, 1-3 Henchmen, 0-1 Beast"; no other fighter, Brutes among them, can join (p. 151). */
		party: {
			size: 5,
			excluded: ['brute'],
			slots: [
				{ label: 'Leader or Champion', keywords: ['leader', 'champion'], min: 1, max: 1 },
				{ label: 'Henchmen', single: 'Henchman', keywords: ['henchman'], min: 1, max: 3 },
				{ label: 'Beast', keywords: ['beast'], min: 0, max: 1 }
			]
		},
		/* Only the Belfry's and the Crossroads' further rolls come from the table itself; a party resolves one encounter. */
		most: () => ({ count: 1, why: null }),
		aids: (warband, party) => [
			{ text: 'A scenario that grants an exploration re-roll, such as Battle for the Tower for the winner, adds one.' },
			...rulesOf(warband, party)
				.filter(({ rule }) => /exploration re-roll/i.test(rule.text))
				.map(({ source, rule }) => ({ text: `${rule.name} (${source}): ${rule.text}` }))
		]
	};
}
