/**
 * Wyrdcry's Explore District, step 3 of the aftermath (Campaign Book,
 * pp. 9 and 18–26): the encounters, the two loot tables and the magic items,
 * from `encounters.json` and `loot.json` in the shared form. What the app
 * keeps – gold, shards, favour, a piece into the stash, a roll on a loot
 * table, a magic item – becomes a gain; anything else an encounter does, such
 * as an injury roll or a recruit, is marked to be noted by hand.
 */

import type { Encounter, Explore, FindAmount, FindGain, FindOption, FindTable, Warband } from '$lib/core/types';

import encounters from '$lib/rules/wyrdcry/encounters.json';
import heroicTalents from '$lib/rules/wyrdcry/heroic-talents.json';
import items from '$lib/rules/wyrdcry/items.json';
import loot from '$lib/rules/wyrdcry/loot.json';
import magicItems from '$lib/rules/wyrdcry/magic-items.json';

/** An action as the data writes it: `{ "table": "lesser", "times": 2 }`, `{ "gold": 10 }`. */
type RawAction = Record<string, unknown>;

interface RawCheck {
	dice?: string;
	test?: string;
	hero?: number;
	results: { on?: string; each?: string; do: RawAction[] }[];
}

interface RawEncounter {
	roll: string;
	name: string;
	text: string;
	mishap?: boolean;
	do?: RawAction[];
	choose?: { label: string; do: RawAction[]; check?: RawCheck }[];
	check?: RawCheck;
}

/* Under the headings of the Campaign Book's list, p. 9, by the number of dice alike. */
const GROUPS: Record<number, string> = { 2: 'Doubles', 3: 'Triples', 4: 'Quads' };

/* The magic items in the order the d6 picks them, p. 25. */
const MAGIC = { roll: 'D6', wargear: [...magicItems].sort((a, b) => a.roll - b.roll).map((m) => `magic:${m.id}`) };

/** A count as the data writes it – `2`, `"d3"`, `"d3x10"`, `"d3+1"` – with the values the roll may come to. */
function amount(raw: unknown): FindAmount | null {
	if (typeof raw === 'number') return raw;
	const match = typeof raw === 'string' ? /^d(\d+)(?:x(\d+)|\+(\d+))?$/.exec(raw) : null;
	if (!match) return null;
	const [, sides, times, plus] = match;
	const values = Array.from({ length: +sides }, (_, i) => (i + 1) * (times ? +times : 1) + (plus ? +plus : 0));
	return { roll: `D${sides}${times ? ` × ${times}` : ''}${plus ? ` + ${plus}` : ''}`, values };
}

/** The gains a list of actions brings, and whether one of them is left to be noted by hand. */
function gainsOf(actions: RawAction[]): { gains: FindGain[]; byHand: boolean } {
	const gains: FindGain[] = [];
	let byHand = false;
	for (const action of actions) {
		const count = (key: string) => amount(action[key]);
		if ('table' in action) {
			const times = typeof action.times === 'number' ? action.times : 1;
			for (let n = 0; n < times; n++) gains.push({ table: String(action.table) });
		} else if ('gold' in action && count('gold') !== null) gains.push({ gold: count('gold')! });
		else if ('shards' in action && count('shards') !== null) gains.push({ shards: count('shards')! });
		else if ('favour' in action && typeof action.favour === 'number') gains.push({ tally: 'favour', amount: action.favour });
		else if ('wargear' in action) gains.push({ wargear: String(action.wargear), ...('copies' in action && count('copies') !== null ? { copies: count('copies')! } : {}) });
		else if ('magic' in action) gains.push({ unique: MAGIC });
		else byHand = true;
	}
	return { gains, byHand };
}

/** A roll's results as answers: `1–3`, `4+`; a test as passed or failed. Null where the roll counts each die, which is noted by hand. */
function askOf(check: RawCheck): Encounter['ask'] | null {
	if (check.results.some((r) => r.each)) return null;
	const label = check.test
		? `Take a ${check.test[0].toUpperCase()}${check.test.slice(1)} test`
		: `Roll a ${check.dice ?? 'D6'}${check.hero ? `, +${check.hero} for a HERO` : ''}`;
	const options = check.results.map((r): FindOption => {
		const { gains, byHand } = gainsOf(r.do);
		const on = r.on ?? '';
		const name = on === 'pass' ? 'Passed' : on === 'fail' ? 'Failed' : on.replace('-', '–');
		return { label: name, gains, ...(byHand ? { byHand } : {}) };
	});
	return { label, options };
}

function encounterOf(raw: RawEncounter): Encounter {
	const { gains, byHand } = gainsOf(raw.do ?? []);
	let ask: Encounter['ask'] | null = null;
	let unkept = byHand;
	if (raw.choose) {
		ask = {
			label: 'Choose one',
			options: raw.choose.map((c): FindOption => {
				const own = gainsOf(c.do);
				/* A roll made after the choice, such as the charlatan's, is noted by hand. */
				const left = own.byHand || Boolean(c.check);
				return { label: c.label, gains: own.gains, ...(left ? { byHand: true } : {}) };
			})
		};
	} else if (raw.check) {
		ask = askOf(raw.check);
		if (!ask) unkept = true;
	}
	return {
		roll: raw.roll,
		name: raw.name,
		text: raw.text,
		group: GROUPS[raw.roll.length] ?? '',
		...(raw.mishap ? { mishap: true } : {}),
		gains,
		...(ask ? { ask } : {}),
		...(unkept ? { byHand: true } : {})
	};
}

const tables: FindTable[] = loot.tables.map((t) => ({
	id: t.id,
	name: t.name,
	dice: t.dice,
	rows: t.rows.map((r) => ({ roll: r.roll, name: r.name, text: r.text, gains: gainsOf(r.gain as RawAction[]).gains }))
}));

/** What a piece or a talent does for the exploration roll, as the data writes it under `explore`. */
interface RawAid {
	encounters?: number;
	dice?: number;
	adjust?: number;
	set?: number;
	discard?: boolean;
}

const withAid = <T extends { id: string; name: string }>(list: T[], prefix: string) =>
	list.flatMap((x) => {
		const aid = (x as { explore?: RawAid }).explore;
		return aid ? [{ id: `${prefix}${x.id}`, name: x.name, aid }] : [];
	});

/* Scout (p. 14): a talent of a fighter in the party lets it resolve more encounters. */
const talents = withAid(heroicTalents, '');
/* The Wyrdstone Pendulum (p. 28) and Von Adelbrecht's Compass (p. 25), carried by one in the party; the Ornate Key (p. 24), in the stash and given up once used. */
const pieces = [...withAid(items, 'item:'), ...withAid(magicItems, 'magic:'), ...withAid(loot.pieces, 'loot:')];

const nameOf = (warband: Warband, instanceId: string) => warband.fighters.find((f) => f.instanceId === instanceId)?.name.trim() || 'Unnamed fighter';

/** What an aid lets the player do to the roll, as a sentence's end. */
function aidText(aid: RawAid): string {
	if (aid.dice) return `roll ${aid.dice} more exploration ${aid.dice === 1 ? 'die' : 'dice'}`;
	if (aid.adjust) return `add or subtract ${aid.adjust} on one exploration die`;
	return 'set one exploration die to any value, then give it up';
}

export const explore: Explore = {
	label: 'Explore District',
	encounters: (encounters as RawEncounter[]).map(encounterOf),
	tables,
	/* "Select up to 5 fighters that were not taken out of action ... and that don't have the BEAST or THRALL keyword" (p. 9). */
	party: { size: 5, excluded: ['beast', 'thrall'] },
	most: (warband, party) => {
		let count = 1;
		const by: string[] = [];
		for (const id of party) {
			const fighter = warband.fighters.find((f) => f.instanceId === id);
			for (const t of talents) {
				if (t.aid.encounters && fighter?.advances?.some((a) => a.rule === t.id)) {
					count = Math.max(count, t.aid.encounters);
					by.push(`${t.name} (${nameOf(warband, id)})`);
				}
			}
		}
		return { count, why: by.length ? by.join(', ') : null };
	},
	aids: (warband, party) =>
		pieces.flatMap(({ id, name, aid }) => {
			if (aid.discard) return (warband.stash ?? []).includes(id) ? [{ text: `${name} from the stash: ${aidText(aid)}.`, spend: id }] : [];
			const bearers = party.filter((p) => warband.fighters.find((f) => f.instanceId === p)?.wargear.includes(id));
			return bearers.length ? [{ text: `${name} (${bearers.map((b) => nameOf(warband, b)).join(', ')}): ${aidText(aid)}.` }] : [];
		})
};
