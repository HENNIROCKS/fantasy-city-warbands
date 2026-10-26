/**
 * Wyrdcry's Explore District, step 3 of the aftermath (Campaign Book,
 * pp. 9 and 18–26): the encounters, the two loot tables and the magic items,
 * from `encounters.json` and `loot.json` in the shared form. What the app
 * keeps – gold, shards, favour, a piece into the stash, a roll on a loot
 * table, a magic item, what falls on the fighter an encounter picks, a
 * recruit, what the next battle or exploration brings – becomes a gain;
 * anything else is marked to be noted by hand.
 */

import type { Encounter, Explore, FindAmount, FindGain, FindOption, FindTable, NextBattle, Warband } from '$lib/core/types';

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
	who?: string;
	do?: RawAction[];
	choose?: { label: string; do: RawAction[]; who?: string; check?: RawCheck }[];
	check?: RawCheck;
}

/* Who an encounter picks, as the data names it (pp. 18–23). */
const WHO: Record<string, Encounter['who']> = {
	party: { from: 'party' },
	'party-by-opponent': { from: 'party', note: 'Your opponent picks the fighter.' },
	'party-hero-or-henchman-by-opponent': { from: 'party', note: 'Pick a HERO, or your opponent picks a HENCHMAN.' },
	'hero-with-injury': { from: 'warband', keyword: 'hero', injured: true }
};

/* Under the headings of the Campaign Book's list, p. 9, by the number of dice alike. */
const GROUPS: Record<number, string> = { 2: 'Doubles', 3: 'Triples', 4: 'Quads' };

/* What an encounter leaves for later, as the data names it: the Mad Prophet, the Shrine and To the Rescue for the next battle, the Tower for the next exploration (pp. 18–22). Bravery is a roll to meet, so improving it takes 1 off. */
const NEXT: Record<string, Omit<NextBattle, 'source'>> = {
	'bravery-improved': { text: 'Improve the Bravery of every fighter by 1.', stat: { key: 'bravery', bonus: -1 } },
	'bravery-worsened': { text: 'Worsen the Bravery of every fighter by 1.', stat: { key: 'bravery', bonus: 1 } },
	'wyrd-die': { text: 'Begin the battle with one additional Wyrd Dice.' },
	'free-hire': { text: 'Recruit a HIRED SWORD without paying their recruitment fee.', freeHire: true },
	'set-die': { text: 'After the exploration roll, you may change 1 dice result to a value of your choice.', explore: true }
};

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
		else if ('injury_roll' in action) gains.push({ injuryRoll: { treat: ((action.injury_roll as { treat?: Record<string, string> }).treat ?? {}) } });
		else if ('injury' in action) gains.push({ injury: String(action.injury) });
		else if ('renown' in action && typeof action.renown === 'number') gains.push({ levels: action.renown });
		else if ('heal' in action) gains.push({ heal: true });
		else if ('remove' in action) gains.push({ remove: true });
		else if ('recruit' in action) {
			const r = action.recruit as { keyword: string; below: number; free?: boolean; set?: Record<string, number> };
			gains.push({ recruit: { keyword: r.keyword, below: r.below, ...(r.free ? { free: true } : {}), ...(r.set ? { set: r.set } : {}) } });
		} else if (('next_battle' in action || 'next_explore' in action) && NEXT[String(action.next_battle ?? action.next_explore)])
			gains.push({ next: NEXT[String(action.next_battle ?? action.next_explore)] });
		else if ('stat' in action) {
			for (const [key, bonus] of Object.entries(action.stat as Record<string, number>)) gains.push({ stat: { key, bonus } });
		} else byHand = true;
	}
	return { gains, byHand };
}

/** A roll that counts its dice, such as the Wyrdstone Cluster's 4d6: how many show each result. */
function eachOf(check: RawCheck): FindGain {
	const dice = Number(/^(\d+)/.exec(check.dice ?? '')?.[1] ?? 1);
	return {
		each: {
			dice,
			results: check.results.map((r) => ({ on: r.each ?? '', label: `Dice showing ${r.each}`, gains: gainsOf(r.do).gains }))
		}
	};
}

/** A roll's results as answers: `1–3`, `4+`; a test as passed or failed. */
function askOf(check: RawCheck): NonNullable<Encounter['ask']> {
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
	let who = raw.who ? WHO[raw.who] : undefined;
	if (raw.choose) {
		/* A roll made after a choice, such as the charlatan's, is one answer for each result, the choice's own gains first. */
		ask = {
			label: 'Choose one',
			options: raw.choose.flatMap((c): FindOption[] => {
				const own = gainsOf(c.do);
				if (c.who) who = WHO[c.who];
				if (!c.check) return [{ label: c.label, gains: own.gains, ...(own.byHand ? { byHand: true } : {}) }];
				return askOf(c.check).options.map((o) => ({
					label: `${c.label}, rolled ${o.label}`,
					gains: [...own.gains, ...o.gains],
					...(own.byHand || o.byHand ? { byHand: true } : {})
				}));
			})
		};
	} else if (raw.check?.results.some((r) => r.each)) gains.push(eachOf(raw.check));
	else if (raw.check) ask = askOf(raw.check);
	return {
		roll: raw.roll,
		name: raw.name,
		text: raw.text,
		group: GROUPS[raw.roll.length] ?? '',
		...(raw.mishap ? { mishap: true } : {}),
		...(who ? { who } : {}),
		gains,
		...(ask ? { ask } : {}),
		...(byHand ? { byHand: true } : {})
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
	aids: (warband, party) => [
		/* The Tower's help, left by the exploration before. */
		...(warband.next ?? []).filter((n) => n.explore).map((n) => ({ text: `${n.source}: ${n.text}` })),
		...pieces.flatMap(({ id, name, aid }) => {
			if (aid.discard) return (warband.stash ?? []).includes(id) ? [{ text: `${name} from the stash: ${aidText(aid)}.`, spend: id }] : [];
			const bearers = party.filter((p) => warband.fighters.find((f) => f.instanceId === p)?.wargear.includes(id));
			return bearers.length ? [{ text: `${name} (${bearers.map((b) => nameOf(warband, b)).join(', ')}): ${aidText(aid)}.` }] : [];
		})
	]
};
