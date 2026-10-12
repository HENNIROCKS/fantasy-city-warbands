/**
 * Wyrdcry, from the ruleset under `src/lib/rules/wyrdcry/`, which is kept in the
 * same shape as the Wyrdcry Warband Deck's so the two can be compared file by
 * file. Every folder under `factions/` is one faction.
 */

import type { Faction, FactionCounter, Fighter, FighterChoice, FighterInstance, GameSystem, Rule, StatCondition, Wargear, Warband } from '$lib/core/types';
import { purse } from '$lib/core/validate';

import weapons from '$lib/rules/wyrdcry/weapons.json';
import items from '$lib/rules/wyrdcry/items.json';
import weaponRules from '$lib/rules/wyrdcry/weapon-rules.json';
import universal from '$lib/rules/wyrdcry/universal-abilities.json';
import campaign from '$lib/rules/wyrdcry/campaign.json';
import curatedConditions from '$lib/rules/wyrdcry/conditions.json';
import curatedGrants from '$lib/rules/wyrdcry/item-grants.json';
import heroicTalents from '$lib/rules/wyrdcry/heroic-talents.json';

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
	health: 'health',
	/* The Warband Deck's roster. */
	roster: {
		title: 'Wyrdcry Warband Roster',
		stats: ['M', 'F', 'S', 'A', 'H', 'B'],
		weapons: ['Rng', 'Att', 'Dmg']
	},
	roles: ['leader', 'hero', 'henchman'],
	defaultRole: 'henchman',
	roleLabels: { leader: 'Leader', hero: 'Heroes', henchman: 'Henchmen' },
	groups: [],
	costLabel: 'Gold Coins',
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
	},
	carry,
	campaign: {
		warband: [{ key: 'favour', label: 'Favour' }],
		fighter: [{ key: 'renown', label: 'Renown' }],
		/* As on the Warband Deck's card, but Standing on a row of its own: beside
		   Reputation a standing such as Recognized does not fit a phone. Reputation
		   is every fighter's renown and the favour, as the builder counts it. */
		values: (warband) => {
			const favour = warband.tally?.favour ?? 0;
			const reputation = warband.fighters.reduce((sum, f) => sum + (f.tally?.renown ?? 0), favour);
			return [
				{ key: 'favour', label: 'Favour', value: String(favour) },
				{ key: 'reputation', label: 'Reputation', value: String(reputation) },
				{ key: 'standing', label: 'Standing', value: tierFor(favour).label, wide: true }
			];
		}
	},
	aftermath: {
		questions: [
			{ key: 'participated', label: 'Participated', start: 'yes' },
			{ key: 'survived', label: 'Not taken out of action', start: 'not-out' },
			{ key: 'enemy-out', label: 'Took an enemy out of action', start: 'no' }
		],
		bonus: true,
		/* `keywords.json`: BEAST and THRALL both read "Never earn experience or gain renown". */
		noXp: ['beast', 'thrall'],
		gainXp,
		income
	},
	/* As the Warband Deck tracks them. Cover changes no figure of the fighter's:
	   it raises the difficulty rating of a ranged attack against it, a number on
	   the attacker's side. */
	battle: {
		waiting: true,
		marks: [
			{ key: 'heroic', label: 'Heroic reaction used', keyword: 'hero', lasts: 'battle' },
			{
				key: 'cover',
				label: 'In cover',
				lasts: 'battle',
				conditions: [
					{
						stat: 'defense',
						name: 'In Cover',
						text: 'A ranged attack action against this fighter has its difficulty rating (DR) increased by 1.'
					}
				]
			},
			{ key: 'panicked', label: 'Panicked', lasts: 'round', bonus: { fight: -1, shoot: -1 } }
		],
		/* Half the warband out of action, rounding up: each fighter takes a
		   Bravery test when first activated in a round, and a fail panics it
		   until the round ends. */
		wavering: { threshold: (size) => Math.ceil(size / 2), test: 'Bravery test', failed: 'panicked' }
	}
};

type FavourTier = (typeof campaign.favour_tiers)[number];

/**
 * The standing a favour score is in, off the income page's four tiers rather
 * than the campaign data's five (DEVIATIONS.md). The last tier is open at the top.
 */
function tierFor(favour: number): FavourTier {
	const tiers = campaign.favour_tiers;
	return tiers.find((t) => favour >= t.min && favour <= t.max) ?? tiers[tiers.length - 1];
}

/**
 * As the Warband Builder's reducer has it (`SET_FIGHTER_XP`): on the point that
 * would make a fourth, experience goes back to 0 and renown rises by one. Applied
 * a point at a time, so a gain of several crosses the threshold as that many
 * single points would, more than one level included.
 */
function gainXp(fighter: FighterInstance, points: number): FighterInstance {
	let xp = fighter.xp ?? 0;
	let renown = fighter.tally?.renown ?? 0;
	for (let i = 0; i < points; i++) {
		xp += 1;
		if (xp > 3) {
			xp = 0;
			renown += 1;
		}
	}
	return { ...fighter, xp, tally: { ...fighter.tally, renown } };
}

/**
 * Step 4 of the aftermath: a favour for each shard and one more for a win, then
 * the income of the standing the warband now holds, so a rise counts at once.
 * The gold goes into the purse, which counts the warband's value in.
 */
function income(warband: Warband, game: GameSystem, result: 'win' | 'draw' | 'loss' | null, shards: number) {
	const before = warband.tally?.favour ?? 0;
	const favour = shards + (result === 'win' ? 1 : 0);
	const tier = tierFor(before + favour);
	const gold = tier.income + tier.per_shard * shards;
	const rises = tier.label !== tierFor(before).label;
	return {
		tally: { ...warband.tally, favour: before + favour },
		gold: purse(warband, game) + gold,
		lines: [
			{ gain: `+${favour} favour`, why: `→ ${before + favour}, ${tier.label}${rises ? ' (a rise in standing)' : ''}` },
			{ gain: `+${gold} gc`, why: `– ${tier.income} gc${shards ? ` and ${shards} × ${tier.per_shard} gc` : ''}` }
		]
	};
}

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
	choose: RawChoice | null;
}

/**
 * What a fighter picks on recruitment, as the Warband Deck writes it. `roles`
 * only a homebrew fighter has, and `instead_of_talent` belongs to the campaign.
 */
interface RawChoice {
	/** The ability the choice comes out of, by id. */
	source: string | null;
	prompt?: string;
	kind: 'stat' | 'ability' | 'roll' | 'role';
	pick: number;
	characteristics?: string[];
	bonus?: number;
	abilities?: string[];
	/** The id of the rule carrying the table. */
	table?: string;
}

/** A row of a roll table, such as the Possessed's Mutation Table. */
interface RawRow {
	roll: string;
	name: string;
	text: string;
	keywords?: string[];
	/** A weapon id from `weapons.json`. */
	weapon?: string;
}

interface RawRule {
	id: string;
	name: string;
	text: string;
	pick: number | null;
	options: { id: string; name: string; text: string }[];
	table?: RawRow[];
	/** What the rule does that the app counts, as the Warband Deck writes it; only Zeal is read here. */
	effect?: RawEffect | null;
}

/** A stage of Zeal, as the Warband Deck's ruleset writes it. `except` is a keyword id. */
interface RawEffect {
	kind: string;
	at?: number;
	label?: string;
	amounts?: Record<string, number>;
	except?: string;
	/** What the stage adds in one situation only: to which characteristics, how much, when. */
	conditions?: { stats: string[]; amount: number; text: string };
}

interface RawAbility {
	id: string;
	name: string;
	/** What using it costs: `double`, `triple`, `reaction`; `trait` for one that is always on. */
	type: string;
	text: string;
}

/**
 * What a weapon rule or an item adds in one situation only, and what an item
 * gives while carried, kept by hand as the Warband Deck keeps it: the game data
 * says it only in the text. Parry raises the defender's Fight when targeted in
 * melee; the Shield does the same, and against a ranged attack raises the
 * attacker's difficulty rating instead, which goes under Armour without a number,
 * since a +1 there would read as a point of Armour. `expect` is the wording each
 * entry was taken from: a development build says when the text has moved away
 * from it, which is the moment the entry is either wrong or no longer needed.
 */
function curated<T extends { weaponRule?: string; item?: string; expect: string }>(entries: T[], what: string): Map<string, { entry: T; name: string; text: string }[]> {
	const map = new Map<string, { entry: T; name: string; text: string }[]>();
	for (const entry of entries) {
		const key = entry.weaponRule ? `rule:${entry.weaponRule}` : `item:${entry.item}`;
		const source = entry.weaponRule ? weaponRules.find((r) => r.id === entry.weaponRule) : items.find((i) => i.id === entry.item);
		if (import.meta.env.DEV) {
			if (!source) console.warn(`curated ${what}: no "${key}" in the game data`);
			else if (!source.text.includes(entry.expect)) console.warn(`curated ${what}: "${key}" no longer reads "${entry.expect}"`);
		}
		if (source) map.set(key, [...(map.get(key) ?? []), { entry, name: source.name, text: source.text }]);
	}
	return map;
}

const conditionsBy = new Map(
	[...curated(curatedConditions, 'conditions')].map(([key, list]) => [
		key,
		list.map(({ entry, name, text }): StatCondition => ({ stat: entry.characteristic, ...(entry.bonus !== null ? { bonus: entry.bonus } : {}), name, text }))
	])
);

/* Talents an item gives while it is carried, the Elven Cloak's Stealthy, as rules of their own. */
const grantsBy = new Map(
	[...curated(curatedGrants, 'grants')].map(([key, list]) => [
		key,
		list.flatMap(({ entry }): Rule[] => {
			const talent = heroicTalents.find((t) => t.id === entry.talent);
			return talent ? [{ name: talent.name, text: talent.text, type: talent.type }] : [];
		})
	])
);

const weaponRule = new Map(
	weaponRules.map((r) => [r.id, { name: r.name, text: r.text, ...(conditionsBy.has(`rule:${r.id}`) ? { conditions: conditionsBy.get(`rule:${r.id}`) } : {}) }])
);

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
			? [
					[
						`item:${i.id}`,
						{
							id: `item:${i.id}`,
							name: i.name,
							kind: i.type === 'armour' ? 'armour' : 'item',
							cost: i.cost,
							text: i.text,
							...(i.effects.length ? { effects: i.effects.map((e) => ({ stat: e.characteristic, bonus: e.bonus })) } : {}),
							...(conditionsBy.has(`item:${i.id}`) ? { conditions: conditionsBy.get(`item:${i.id}`) } : {}),
							...(grantsBy.has(`item:${i.id}`) ? { grants: grantsBy.get(`item:${i.id}`) } : {})
						}
					]
				]
			: []
	)
]);

/*
 * What a fighter may carry, as the Warband Deck's `build/equipment.ts` has it:
 * two melee slots, one ranged, a shield in a melee slot, a two-handed weapon in
 * both, a BRACE pair in one. The same melee weapon may be taken twice – that is
 * what makes a fighter dual wielding – a ranged one may not, unless it braces,
 * where the pair is the point.
 */

const MELEE_SLOTS = 2;
const RANGED_SLOTS = 1;

const weaponOf = new Map(weapons.map((w) => [`weapon:${w.id}`, w]));
const itemOf = new Map(items.map((i) => [`item:${i.id}`, i]));

/** What the shared form leaves out and the carrying rules read, by faction and fighter id. */
const carrying = new Map<string, { raw: RawFighter; equipment: Allowance[] }>();

/** Why a fighter takes nothing at all, whatever it is, or undefined where it takes some. */
function takesNothing(raw: RawFighter): string | undefined {
	if (raw.keywords.includes('beast')) return 'A BEAST fights with what is on its profile and cannot be given equipment';
	if (raw.keywords.includes('thrall')) return 'A THRALL cannot be equipped with any weapons, armour or equipment';
	if (raw.abilities.includes('ascended')) return 'An Ascended fighter refuses to be equipped with any weapons, armour or equipment';
	return undefined;
}

function slotsFree(held: string[]): { melee: number; ranged: number } {
	let melee = 0;
	let ranged = 0;
	const braced = new Set<string>();
	for (const id of held) {
		/* A shield needs a hand, so it is counted with the weapons rather than the armour. */
		if (itemOf.get(id)?.slot === 'hand') {
			melee += 1;
			continue;
		}
		const weapon = weaponOf.get(id);
		if (!weapon) continue;
		if (weapon.type === 'melee') melee += weapon.rules.includes('two-handed') ? 2 : 1;
		else if (weapon.rules.includes('brace')) {
			/* Both copies of a braced pair share the one slot. */
			if (!braced.has(id)) ranged += 1;
			braced.add(id);
		} else ranged += 1;
	}
	return { melee: MELEE_SLOTS - melee, ranged: RANGED_SLOTS - ranged };
}

/**
 * Why the fighter cannot take `id` beside what it already holds, or null when
 * it can. The message is the Warband Deck's sentence; the short one fits the
 * disabled button.
 */
function refuse(raw: RawFighter, equipment: Allowance[], held: string[], id: string): { message: string; short: string } | null {
	const same = (message: string) => ({ message, short: message });

	const allowance = equipment.find((e) => e.id === id);
	if (allowance?.restrict && !raw.keywords.includes(allowance.restrict)) return same(`${allowance.restrict.toUpperCase()} only`);
	if (allowance && allowance.allow !== 'all' && !raw.keywords.includes(allowance.allow)) {
		return same(`${allowance.allow.toUpperCase()} only`);
	}

	const weapon = weaponOf.get(id);
	const item = itemOf.get(id);
	const free = slotsFree(held);
	const carried = held.filter((entry) => entry === id).length;

	if (item?.type === 'armour') {
		if (raw.keywords.includes('wizard')) return { message: 'A WIZARD cannot wear armour', short: 'Not for a WIZARD' };
		if (raw.abilities.includes('penitent')) return { message: 'A PENITENT fighter cannot wear armour', short: 'Not for a PENITENT' };
		if (raw.abilities.includes('armour-of-faith')) {
			return { message: 'A fighter with Armour of Faith cannot wear armour', short: 'Armour of Faith' };
		}
		if (carried) return same('Already worn');
		/* One piece of body armour at a time – light or heavy, not both. */
		if (item.slot === 'body' && held.some((worn) => itemOf.get(worn)?.slot === 'body')) return same('Already wearing armour');
		if (item.slot === 'hand' && free.melee < 1) return same('No hand free');
		return null;
	}
	if (!weapon) return null;

	if (weapon.type === 'ranged' && raw.abilities.includes('penitent')) {
		return { message: 'A PENITENT fighter cannot be equipped with ranged weapons', short: 'Not for a PENITENT' };
	}
	if (weapon.type === 'melee') {
		const cost = weapon.rules.includes('two-handed') ? 2 : 1;
		if (cost === 2 && carried) return same('A two handed weapon fills both hands');
		if (free.melee < cost) return same(cost === 2 ? 'Needs both hands' : 'No hand free');
		return null;
	}
	if (weapon.rules.includes('brace')) {
		if (carried >= 2) return same('A braced pair is two');
		/* The second of a pair rides along in the slot the first one took. */
		if (carried === 1) return null;
		return free.ranged < 1 ? same('No ranged slot free') : null;
	}
	if (carried) return same('Already carried');
	return free.ranged < 1 ? same('No ranged slot free') : null;
}

/* Fixed gear fills its hands like anything else – an Elf Ranger holds a bow
   and a sword before a single coin is spent. */
function carry(fighter: Fighter, faction: Faction, wargear: string[]) {
	const found = carrying.get(`${faction.id}/${fighter.id}`);
	if (!found) return [];
	const name = (id: string) => faction.wargear.find((w) => w.id === id)?.name ?? id;
	return wargear.flatMap((id, i) => {
		const refused = refuse(found.raw, found.equipment, [...fighter.gear, ...wargear.slice(0, i)], id);
		return refused ? [{ message: `${name(id)}: ${refused.message}.`, short: refused.short }] : [];
	});
}

/** The Deck's `choose` in the shared form, or undefined where it is one this app does not offer. */
function choiceOf(raw: RawChoice | null, rules: RawRule[], ability: Map<string, RawAbility>): FighterChoice | undefined {
	if (!raw) return undefined;
	const source = raw.source ? ability.get(raw.source) : undefined;
	const prompt = raw.prompt ?? source?.text ?? '';
	const base = { prompt, source: source?.name, pick: raw.pick };

	if (raw.kind === 'ability') {
		const options = (raw.abilities ?? []).flatMap((id) => {
			const a = ability.get(id);
			return a ? [{ id, name: a.name, text: a.text, type: a.type }] : [];
		});
		return { ...base, options };
	}
	if (raw.kind === 'stat') {
		const bonus = raw.bonus ?? 0;
		const options = (raw.characteristics ?? []).map((key) => ({
			id: key,
			name: `${game.stats.find((s) => s.key === key)?.label ?? key} +${bonus}`,
			text: '',
			bonus: { [key]: bonus }
		}));
		return { ...base, options };
	}
	if (raw.kind === 'roll') {
		const table = rules.find((r) => r.id === raw.table);
		const options = (table?.table ?? []).map((row) => ({
			id: row.roll,
			name: row.name,
			text: row.text,
			keywords: row.keywords,
			gear: row.weapon ? [`weapon:${row.weapon}`] : undefined
		}));
		return { ...base, roll: table?.name, options };
	}
	return undefined;
}

function build(
	meta: RawFaction,
	fighters: RawFighter[],
	equipment: Allowance[],
	rules: RawRule[],
	abilities: RawAbility[]
): Faction {
	const ability = new Map(abilities.map((a) => [a.id, a]));
	for (const raw of fighters) carrying.set(`${meta.id}/${raw.id}`, { raw, equipment });

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
			/* Offered whether the fighter may take it or not: a player looking for a
			   Handgun needs to read that it is for HEROes, not to find it missing. */
			wargear: takesNothing(f) ? [] : equipment.map((e) => e.id),
			unequipped: takesNothing(f),
			gear: f.gear,
			choice: choiceOf(f.choose, rules, ability)
		})),
		/* What a fighter carries from the start, or gets from a table row, has to
		   resolve as well as what it can buy. */
		wargear: [
			...new Set([
				...equipment.map((e) => e.id),
				...fighters.flatMap((f) => f.gear),
				...rules.flatMap((r) => (r.table ?? []).flatMap((row) => (row.weapon ? [`weapon:${row.weapon}`] : [])))
			])
		].flatMap((id) => catalogue.get(id) ?? []),
		counter: zeal(rules)
	};
}

/** The faction's Zeal, where its rules have stages of it. */
function zeal(rules: RawRule[]): FactionCounter | undefined {
	const stages = rules
		.flatMap((r) => (r.effect?.kind === 'zeal' ? [r.effect] : []))
		.map((e) => ({
			at: e.at ?? 0,
			label: e.label ?? '',
			bonus: e.amounts ?? {},
			...(e.except ? { except: e.except } : {}),
			...(e.conditions
				? { conditions: e.conditions.stats.map((stat) => ({ stat, bonus: e.conditions!.amount, name: e.label ?? '', text: e.conditions!.text })) }
				: {})
		}))
		.sort((a, b) => a.at - b.at);
	return stages.length ? { label: 'Zeal', stages } : undefined;
}

/**
 * The prefixed id of a weapon or item the Warband Builder and the Warband Deck
 * store bare, or null where the game data has neither.
 */
export function wargearId(bare: string): string | null {
	for (const id of [`weapon:${bare}`, `item:${bare}`]) if (catalogue.has(id)) return id;
	return null;
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
