/**
 * Wyrdcry, from the ruleset under `src/lib/rules/wyrdcry/`, which is kept in the
 * same shape as the Wyrdcry Warband Deck's so the two can be compared file by
 * file. Every folder under `factions/` is one faction.
 */

import type { ChoiceEffect, Faction, FactionCounter, Fighter, FighterChoice, GameSystem, Hire, Hireling, Source, StatCondition, UnderdogBonus, Wargear, Warband } from '$lib/core/types';
import { purse } from '$lib/core/validate';
import { advancement } from './wyrdcry-renown';
import { shardRolls, wyrdcryInjuries } from './wyrdcry-injuries';
import { weaponRules, weapons } from './wyrdcry-homebrew';

import items from '$lib/rules/wyrdcry/items.json';
import universal from '$lib/rules/wyrdcry/universal-abilities.json';
import campaign from '$lib/rules/wyrdcry/campaign.json';
import curatedConditions from '$lib/rules/wyrdcry/conditions.json';
import heroicTalents from '$lib/rules/wyrdcry/heroic-talents.json';
import underdogs from '$lib/rules/wyrdcry/underdogs.json';

export const game: GameSystem = {
	id: 'wyrdcry',
	name: 'Wyrdcry',
	edition: 'v1.0',
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
	/* "Modifiers ... can never reduce a characteristic to less than 1" (core rules 1.0, p. 12). */
	statFloor: 1,
	/* The Warband Deck's roster. */
	roster: {
		title: 'Wyrdcry Warband Roster',
		stats: ['M', 'F', 'S', 'A', 'H', 'B'],
		weapons: ['Rng', 'Att', 'Dmg'],
		campaign: ['Ren']
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
	/* "A fighter that isn't equipped with any melee weapon is considered to be
	   unarmed, and uses the Unarmed weapon profile." BEAST and THRALL are out
	   of it, as in the Warband Deck: neither can be equipped at all. Read when
	   asked for, as the catalogue is built further down. */
	get unarmed() {
		return { weapon: catalogue.get('weapon:unarmed')!, except: ['beast', 'thrall'] };
	},
	/* As the Warband Deck sells: half the price, rounded down to 5 gc, never below 5 gc. */
	salePrice: (cost) => Math.max(5, Math.floor(cost / 2 / 5) * 5),
	campaign: {
		warband: [{ key: 'favour', label: 'Favour' }],
		fighter: [{ key: 'renown', label: 'Renown' }],
		/* As on the Warband Deck's card. */
		values: (warband) => {
			const { favour, standing, reputation } = figures(warband);
			return [
				{ key: 'favour', label: 'Favour', value: String(favour) },
				/* Between the two it is read as what the favour buys, which is what it is. */
				{ key: 'standing', label: 'Standing', value: standing },
				{ key: 'reputation', label: 'Reputation', value: String(reputation) }
			];
		},
		/* The leader arrives with a level of renown to spend at once (Campaign Book, p. 7). */
		recruited: (fighter): Record<string, number> => (fighter.keywords.includes('leader') ? { renown: 1 } : {}),
		/* The standing in brackets after the favour it is read off. */
		brief: (warband) => {
			const { favour, standing, reputation } = figures(warband);
			return [
				{ label: 'Favour', short: 'Fav.', value: `${favour} (${standing})` },
				{ label: 'Reputation', short: 'Rep.', value: String(reputation) }
			];
		}
	},
	/* Step 2 of the aftermath, the renown roll (Campaign Book, p. 8). */
	aftermath: {
		roll: { label: 'Renown roll', target: 6 },
		modifiers: [
			{ key: 'survived', label: 'Not taken out of action', start: 'not-out' },
			{ key: 'enemy-out', label: 'Took an enemy out of action', start: 'no' }
		],
		marked: 'Marked for greatness',
		/* Drillmaster (p. 12): one more HENCHMAN for each Drillmaster that came through. */
		extraMarks: (warband, survivors) => ({
			keyword: 'henchman',
			notes: holdersOf(warband, 'drillmaster', survivors).map((who) => `Drillmaster (${who}): one more HENCHMAN may be marked for greatness.`)
		}),
		/* `keywords.json`: BEAST and THRALL both read "Never earn experience or gain renown". */
		excluded: ['beast', 'thrall'],
		gainLevels: (fighter, levels) => ({ ...fighter, tally: { ...fighter.tally, renown: (fighter.tally?.renown ?? 0) + levels } }),
		shardNotes: (warband) =>
			warband.fighters.flatMap((f) => shardRolls(f).map((name) => `${name} (${f.name.trim() || 'Unnamed fighter'}): on a 1–3 one shard fewer – count it in.`)),
		/* Crimson Shade (Campaign Book, p. 29): on a 1–2 the 'Sticky Fingers' lasting injury, `kleptomania` by its id. */
		afterUse: [
			{ wargear: 'item:crimson-shade', label: 'Crimson Shade roll', hit: '1–2 – Sticky Fingers', miss: '3–6 – nothing', injury: 'kleptomania' }
		],
		income
	},
	advancement,
	/* Death of a leader (Campaign Book, p. 8): a HERO takes the LEADER keyword. */
	succession: { keyword: 'hero', none: 'No HERO is left. The Campaign Book has the warband disbanded and a new one started.' },
	/* The rarity roll (Campaign Book, p. 27): a HERO on a 6+, +1 for each HERO
	   more helping, a d3 of a single-use piece. */
	rarity: { keyword: 'hero', target: 6, helper: 1, singleUse: 3 },
	/* Hired Swords (Campaign Book, p. 31), read off their files further down. */
	hiring: {
		label: 'Hired swords',
		get hirelings() {
			return hirelings;
		},
		fees,
		discount: (warband) =>
			warband.picks[HALF_FEE_PICK.choice]?.includes(HALF_FEE_PICK.option) ? 'Well-connected (State Pride): the dearest one hired costs half.' : null,
		halving,
		refuse: refuseHire
	},
	/* Underdogs (Campaign Book, p. 30), an optional rule: 5 reputation behind
	   picks a bonus, each 5 more another, and every fighter adds 1 to its
	   renown roll. Each bonus can be selected once. */
	underdog: {
		gap: underdogs.gap,
		roll: underdogs.roll,
		bonuses: underdogs.bonuses as UnderdogBonus[],
		reputation: (warband) => figures(warband).reputation,
		refuse: (warband, bonus) =>
			bonus.effect === 'standing' && tierFor(warband.tally?.favour ?? 0) === campaign.favour_tiers.at(-1)
				? `${campaign.favour_tiers.at(-1)!.label} is the highest standing`
				: null
	},
	/* Unbending Will is an ability of the fighter's type, which the shared form
	   carries only as a rule's text; the raw fighter still has its id. */
	injuries: wyrdcryInjuries({
		abilities: (faction, fighter) => carrying.get(`${faction.id}/${fighter.id}`)?.raw.abilities ?? [],
		keywords: advancement.keywords
	}),
	/* As the Warband Deck tracks them. Cover changes no figure of the fighter's:
	   it takes 1 off the Shoot of whoever shoots at it, a figure on the
	   attacker's side (core rules 1.0, p. 24). */
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
						text: "A ranged attack action against this fighter decreases the attacker's Shoot characteristic by 1."
					}
				]
			},
			{ key: 'panicked', label: 'Panicked', lasts: 'round', bonus: { fight: -1, shoot: -1 } }
		],
		/* More than half the warband out of action, rounding up, in the morale
		   phase that ends a round: each fighter takes a Bravery test, and a fail
		   panics it until the next morale phase – the next round clears it, as
		   it does any panic (core rules 1.0, p. 33). */
		wavering: { wavers: (out, size) => out > Math.ceil(size / 2), test: 'Bravery test', failed: 'panicked' }
	}
};

type FavourTier = (typeof campaign.favour_tiers)[number];

/** The warband's favour, the standing it buys, and its reputation: every fighter's renown and the favour, as the builder counts it. */
function figures(warband: Warband) {
	const favour = warband.tally?.favour ?? 0;
	const reputation = warband.fighters.reduce((sum, f) => sum + (f.tally?.renown ?? 0), favour);
	return { favour, standing: tierFor(favour).label, reputation };
}

/**
 * The standing a favour score is in, off the Campaign Book's four tiers (p. 10).
 * The last tier is open at the top.
 */
function tierFor(favour: number): FavourTier {
	const tiers = campaign.favour_tiers;
	return tiers.find((t) => favour >= t.min && favour <= t.max) ?? tiers[tiers.length - 1];
}

/** The names of the fighters among `among` that hold a heroic talent, by its id. */
function holdersOf(warband: Warband, talent: string, among: string[]): string[] {
	return warband.fighters
		.filter((f) => among.includes(f.instanceId) && (f.advances ?? []).some((a) => a.rule === talent))
		.map((f) => f.name.trim() || 'Unnamed fighter');
}

/**
 * Step 4 of the aftermath: a favour for each shard, one more for a win and one
 * for each Bootlicker that came through (p. 15), then the income of the standing
 * the warband now holds, so a rise counts at once – `raised` standings higher
 * for the underdog's Bounty, the highest at most. The gold goes into the purse,
 * which counts the warband's value in.
 */
function income(warband: Warband, game: GameSystem, result: 'win' | 'draw' | 'loss' | null, shards: number, survivors: string[], raised: number) {
	const before = warband.tally?.favour ?? 0;
	const bootlickers = holdersOf(warband, 'bootlicker', survivors);
	const favour = shards + (result === 'win' ? 1 : 0) + bootlickers.length;
	const held = tierFor(before + favour);
	const tiers = campaign.favour_tiers;
	const tier = tiers[Math.min(tiers.indexOf(held) + raised, tiers.length - 1)];
	const gold = tier.income + tier.per_shard * shards;
	const rises = held.label !== tierFor(before).label;
	const licked = bootlickers.length ? ` – ${bootlickers.length} for Bootlicker (${bootlickers.join(', ')})` : '';
	const bounty = tier !== held ? ` as ${tier.label} (Bounty)` : '';
	return {
		tally: { ...warband.tally, favour: before + favour },
		gold: purse(warband, game) + gold,
		lines: [
			{ gain: `+${favour} favour`, why: `→ ${before + favour}, ${held.label}${rises ? ' (a rise in standing)' : ''}${licked}` },
			{ gain: `+${gold} gc`, why: `– ${tier.income} gc${shards ? ` and ${shards} × ${tier.per_shard} gc` : ''}${bounty}` }
		]
	};
}

/* The State Pride the Mercenaries may pick: one Hired Sword at half its fee. */
const HALF_FEE_PICK = { choice: 'state-pride', option: 'well-connected' };
/* The heroic talent that rolls for half the fee, once per battle. */
const HALF_FEE_TALENT = 'underground-contacts';

/* The Greenskin Marauders' Hired Swords: no WIZARD for hire where one is on the roster. */
const ONE_WIZARD = { faction: 'greenskin-marauders', keyword: 'wizard' };

function refuseHire(warband: Warband, faction: Faction, hireling: Hireling): string | null {
	if (faction.id !== ONE_WIZARD.faction || !hireling.fighter.keywords.includes(ONE_WIZARD.keyword)) return null;
	const own = warband.fighters.some(
		(i) => i.away !== 'dead' && faction.fighters.find((f) => f.id === i.fighterId)?.keywords.includes(ONE_WIZARD.keyword)
	);
	return own ? `A ${ONE_WIZARD.keyword.toUpperCase()} is on the roster` : null;
}

/** Half a fee, rounded up, as Well-Connected rounds it. */
const half = (fee: number) => Math.ceil(fee / 2);

/**
 * What each hire costs: one hired on the underdog's debt costs nothing, a fee
 * halved on the talent's roll stays halved, and where the warband picked
 * Well-connected the dearest of the others is halved too – worked out afresh,
 * so sending one away moves it to the next.
 */
function fees(warband: Warband, hires: Hire[]): number[] {
	const base = hires.map((h) => hirelings.find((x) => x.fighter.id === h.fighterId)?.fighter.cost ?? 0);
	const halves = warband.picks[HALF_FEE_PICK.choice]?.includes(HALF_FEE_PICK.option);
	const open = base.map((fee, i) => (hires[i].halved || hires[i].free ? -1 : fee));
	const dearest = halves ? open.indexOf(Math.max(...open)) : -1;
	return base.map((fee, i) => (hires[i].free ? 0 : hires[i].halved || (i === dearest && open[i] >= 0) ? half(fee) : fee));
}

/** Who in the warband holds the talent that rolls for half a fee, leaving out whoever sits this battle out. */
function halving(warband: Warband) {
	const talent = heroicTalents.find((t) => t.id === HALF_FEE_TALENT);
	const holders = warband.fighters
		.filter((f) => !f.away && (f.advances ?? []).some((a) => a.rule === HALF_FEE_TALENT))
		.map((f) => f.name.trim() || 'Unnamed fighter');
	return talent && holders.length ? { name: talent.name, holders } : null;
}

interface RawFaction {
	id: string;
	name: string;
	warband_size: { min: number; max: number | null };
	origin: 'official' | 'homebrew';
	author: string;
	source?: Source;
	/** Hired swords a homebrew faction adds itself to, beside those whose own file names it. */
	may_hire?: string[];
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
 * only a homebrew fighter has; `instead_of_talent` is how many more a wizard
 * may learn later with renown.
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
	/** How many more of `abilities` a wizard may learn later, each in place of a heroic talent. */
	instead_of_talent?: number;
	/** With `kind: 'role'`: each role an ability of the fighter's, by id, and what it is armed with. */
	roles?: { id: string; name: string; ability: string; gear: string[] }[];
}

/** A row of a roll table, such as the Possessed's Mutation Table. */
interface RawRow {
	roll: string;
	name: string;
	text: string;
	keywords?: string[];
	/** Added to the profile, such as Daemonic Chitin's Armour. */
	bonus?: Record<string, number>;
	/** A weapon id from `weapons.json`. */
	weapon?: string;
}

interface RawRule {
	id: string;
	name: string;
	text: string;
	pick: number | null;
	options: { id: string; name: string; text: string; effect?: RawOptionEffect | null }[];
	table?: RawRow[];
	/** What the rule does that the app counts. */
	effect?: RawEffect | null;
	/** A keyword id whose carriers the rule leaves out, such as Sudden Accusation for a BEAST. */
	except?: string;
	/** A keyword id only whose carriers the rule applies to. */
	only?: string;
}

/**
 * What a rule does that the app counts, as the Warband Deck's ruleset writes
 * it: a stage of Zeal (`except` a keyword id), a weight in the morale, or how
 * many fighters with one keyword the warband may have for each with another.
 */
interface RawEffect {
	kind: string;
	at?: number;
	label?: string;
	amounts?: Record<string, number>;
	except?: string;
	/** What the stage adds in one situation only: to which characteristics, how much, when. */
	conditions?: { stats: string[]; amount: number; text: string };
	/** With `kind: 'morale'`: what the `fighters`, by id, count for. */
	weight?: number;
	fighters?: string[];
	/** With `kind: 'ratio'`: at most `max` fighters with `keyword` for each with `per`. */
	keyword?: string;
	per?: string;
	max?: number;
}

/**
 * What an option of a picked rule does that the app counts, as the Warband
 * Deck's ruleset writes it: a characteristic raised for some fighters, or who
 * may not be recruited and who at a share of the cost. Huntsmen, Desperate.
 */
interface RawOptionEffect {
	kind: string;
	/** With `kind: 'stat'`. */
	characteristic?: string;
	bonus?: number;
	fighters?: string[] | 'all';
	/** With `kind: 'recruit'`, fighter ids. */
	forbid?: string[];
	discount?: { fighter: string; factor: number }[];
}

/** An option's effect in the shared form: a ban as a limit of none. */
function optionEffect(raw: RawOptionEffect | null | undefined): ChoiceEffect | undefined {
	if (raw?.kind === 'stat' && raw.characteristic && raw.bonus && raw.fighters) {
		return { stats: [{ stat: raw.characteristic, bonus: raw.bonus, fighters: raw.fighters }] };
	}
	if (raw?.kind === 'recruit') {
		return {
			...(raw.forbid?.length ? { limits: raw.forbid.map((fighter) => ({ fighter, limit: { min: 0, max: 0 } })) } : {}),
			...(raw.discount?.length ? { costs: raw.discount } : {})
		};
	}
	return undefined;
}

interface RawAbility {
	id: string;
	name: string;
	/** What using it costs: `double`, `triple`, `reaction`; `trait` for one that is always on. */
	type: string;
	text: string;
}

/**
 * What a weapon rule or an item adds in one situation only, kept by hand as the
 * Warband Deck keeps it: the game data says it only in the text. Parry raises
 * the defender's Fight when targeted in melee; the Shield does the same, and
 * against a ranged attack puts the bearer in cover, as the Elven Cloak does
 * beyond 6" – cover goes under Armour without a number, as the In cover mark
 * does: it changes the attacker's Shoot, not the bearer's figures. `expect` is the wording each
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

const weaponRule = new Map(
	weaponRules.map((r) => [r.id, { name: r.name, text: r.text, ...(conditionsBy.has(`rule:${r.id}`) ? { conditions: conditionsBy.get(`rule:${r.id}`) } : {}) }])
);

/** A reach of `{ min: 0, max: 1 }` as the card prints it: `1"`, or `4–18"` where it starts further out. */
function range({ min, max }: { min: number; max: number }): string {
	return min ? `${min}–${max}"` : `${max}"`;
}

/**
 * A Hired Sword as the Warband Deck writes it, one file each: its own abilities
 * and the weapons only it carries are in the file; what the shared lists hold,
 * such as a sword, is named by id.
 */
interface RawHiredSword {
	id: string;
	name: string;
	origin: 'official' | 'homebrew';
	source?: Source;
	cost: number;
	limit: { min: number; max: number | null };
	may_hire: string[];
	profile: Record<string, number>;
	keywords: string[];
	gear: string[];
	/** What it picks when hired; only a role so far, such as the Goblin Shaman's. */
	choose: RawChoice | null;
	abilities: RawAbility[];
	weapons: (typeof weapons)[number][];
}

const hiredSwords = Object.values(
	import.meta.glob('/src/lib/rules/wyrdcry/hired-swords/*.json', { eager: true, import: 'default' })
) as RawHiredSword[];

/* A hired sword's own weapon goes into the shared list; one whose id is
   taken there already is left out, so the game's own weapon keeps its profile. */
const hiredWeapons = hiredSwords
	.flatMap((h) => h.weapons)
	.filter((w) => {
		const taken = weapons.some((own) => own.id === w.id);
		if (taken && import.meta.env.DEV) console.warn(`hired sword weapon "${w.id}" is a shared weapon already`);
		return !taken;
	});

/* The Trading Post's two lists, under the Warband Deck's headings. */
const TRADING_POST: Record<string, string> = { miscellaneous: 'Trading Post', 'single-use': 'Trading Post – single use' };

/**
 * Every weapon and item by its prefixed id, as `equipment.json` names them. An
 * item whose cost is a surcharge on a weapon, such as `"+100"`, has no price of
 * its own and is left out.
 */
const catalogue = new Map<string, Wargear>([
	...[...weapons, ...hiredWeapons].map((w): [string, Wargear] => [
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
							...(i.rarity === 'rare' ? { found: 'a Rarity roll of 6+' } : {}),
							/* A faction's own piece, such as Clan Eshin's Smoke Bomb, is sold in its faction entry only. */
							...(i.type in TRADING_POST && !('faction' in i) ? { group: TRADING_POST[i.type] } : {}),
							...(i.type === 'single-use' ? { singleUse: true as const } : {})
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

/*
 * The Trading Post, open to every faction and every fighter who takes
 * equipment at all, as the Warband Deck has it – one of each piece per
 * fighter. The Master-Wrought Weapon raises a weapon's cost rather than being
 * a piece of its own, so the catalogue has no price for it and it stays out.
 */
const postOrder = (w: Wargear) => Object.values(TRADING_POST).indexOf(w.group ?? '');
const tradingPost = [...catalogue.values()]
	.filter((w) => w.group)
	.sort((a, b) => postOrder(a) - postOrder(b))
	.map((w) => w.id);
const fromTradingPost = new Set(tradingPost);

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
	if (fromTradingPost.has(id) && carried) return same('One of each per fighter');
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
		return { ...base, options, noun: { one: 'magical ability', many: 'magical abilities' }, ...(raw.instead_of_talent ? { later: raw.instead_of_talent } : {}) };
	}
	if (raw.kind === 'stat') {
		const bonus = raw.bonus ?? 0;
		const options = (raw.characteristics ?? []).map((key) => ({
			id: key,
			name: `${game.stats.find((s) => s.key === key)?.label ?? key} +${bonus}`,
			text: '',
			bonus: { [key]: bonus }
		}));
		return { ...base, options, noun: { one: 'characteristic', many: 'characteristics' } };
	}
	if (raw.kind === 'roll') {
		const table = rules.find((r) => r.id === raw.table);
		const options = (table?.table ?? []).map((row) => ({
			id: row.roll,
			name: row.name,
			text: row.text,
			keywords: row.keywords,
			bonus: row.bonus,
			gear: row.weapon ? [`weapon:${row.weapon}`] : undefined
		}));
		return { ...base, roll: table?.name, options };
	}
	if (raw.kind === 'role') {
		const options = (raw.roles ?? []).flatMap((role) => {
			const a = ability.get(role.ability);
			if (!a) return [];
			/* The card lists the pick as a rule of the fighter's: the role, and the talent where it has a name of its own. */
			const name = a.name === role.name ? role.name : `${role.name} – ${a.name}`;
			return [{ id: role.id, name, text: a.text, type: a.type, gear: role.gear }];
		});
		return { ...base, options, noun: { one: 'role', many: 'roles' } };
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
		...(meta.source ? { source: meta.source } : {}),
		/* A rule with a pick is asked for as a choice; the rest is read, not decided. */
		rules: rules
			.filter((r) => r.pick === null)
			.map((r) => ({ name: r.name, text: r.text, ...(r.except ? { except: r.except } : {}), ...(r.only ? { only: r.only } : {}) })),
		size: meta.warband_size,
		choices: rules
			.filter((r) => r.pick !== null)
			.map((r) => ({
				id: r.id,
				name: r.name,
				text: r.text,
				pick: r.pick as number,
				options: r.options.map((o) => {
					const effect = optionEffect(o.effect);
					return { id: o.id, name: o.name, text: o.text, ...(effect ? { effect } : {}) };
				})
			})),
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
			wargear: takesNothing(f) ? [] : [...new Set([...equipment.map((e) => e.id), ...tradingPost])],
			unequipped: takesNothing(f),
			gear: f.gear,
			choice: choiceOf(f.choose, rules, ability)
		})),
		/* What a fighter carries from the start, or gets from a table row, has to
		   resolve as well as what it can buy. */
		wargear: [
			...new Set([
				...equipment.map((e) => e.id),
				...tradingPost,
				...fighters.flatMap((f) => f.gear),
				...rules.flatMap((r) => (r.table ?? []).flatMap((row) => (row.weapon ? [`weapon:${row.weapon}`] : [])))
			])
		].flatMap((id) => catalogue.get(id) ?? []),
		counter: zeal(rules),
		weights: Object.fromEntries(
			rules.flatMap((r) => (r.effect?.kind === 'morale' ? (r.effect.fighters ?? []).map((id) => [id, r.effect!.weight ?? 1]) : []))
		),
		ratios: rules.flatMap((r) =>
			r.effect?.kind === 'ratio' && r.effect.keyword && r.effect.per
				? [{ rule: r.name, keyword: r.effect.keyword, per: r.effect.per, max: r.effect.max ?? 0 }]
				: []
		)
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

/* A homebrew faction may add itself to an official hired sword, which keeps what the game prints. */
const addedHires = folders.map((folder) => file<RawFaction>(folder, 'faction')).filter((f) => f.may_hire?.length);

/* A hired sword arrives with what it carries and takes nothing more. */
const hirelings: Hireling[] = hiredSwords
	.map((h) => {
		/* An ability a role brings is the role's, not the hired sword's own. */
		const roles = new Set((h.choose?.roles ?? []).map((r) => r.ability));
		const choice = choiceOf(h.choose, [], new Map(h.abilities.map((a) => [a.id, a])));
		return {
			fighter: {
				id: h.id,
				name: h.name,
				cost: h.cost,
				limit: h.limit,
				keywords: h.keywords,
				profile: h.profile,
				rules: h.abilities.filter((a) => !roles.has(a.id)).map((a) => ({ name: a.name, text: a.text, type: a.type })),
				wargear: [],
				unequipped: 'A HIRED SWORD comes with its own equipment',
				gear: h.gear,
				...(choice ? { choice } : {})
			},
			wargear: [...new Set([...h.gear, ...(choice?.options ?? []).flatMap((o) => o.gear ?? [])])].flatMap((id) => catalogue.get(id) ?? []),
			factions: [...h.may_hire, ...addedHires.filter((f) => f.may_hire?.includes(h.id)).map((f) => f.id)],
			origin: h.origin,
			...(h.source ? { source: h.source } : {})
		};
	})
	.sort((a, b) => a.fighter.name.localeCompare(b.fighter.name));
