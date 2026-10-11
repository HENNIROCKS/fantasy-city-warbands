/**
 * The warband as a printed roster: the warband, one row per fighter, then every
 * rule the warband carries once, with the fighters that carry it. Laid out as
 * the Wyrdcry Warband Deck's roster.
 *
 * It reads the cards rather than the warband. Every figure on the roster is one
 * a card already shows, so the two cannot come apart.
 */

import { fighterCard, warbandCard, type CardEntry, type FighterCardData, type WarbandCardData } from './card';
import type { Faction, GameSystem, Warband } from './types';

export interface RosterFighter {
	name: string;
	type: string;
	/** In the order of the game's stats, spelled as the card spells them. */
	stats: string[];
	cost: string;
	keywords: string;
	/** The fighter's own rules, labelled as on the card: `[Triple] Murder-Stab`. */
	abilities: string[];
	/** Each with its values in the order of the game's weapon columns. */
	weapons: { name: string; values: string[] }[];
	/** Armour and items – no profile, so they share one line. */
	items: string;
}

export interface RosterRule {
	name: string;
	/** `Faction rule`, `Ability`, `Weapon rule`, `Item`, a rule type such as `Triple`, or a choice such as `Origin`. */
	type: string;
	/** `Everyone` where every fighter carries it. */
	fighters: string;
	/** What the rules table sets before the text, as the card labels it: `[Triple]`, `(Origin)`, `(Weapon Rule: Sword)`. Empty for an ability without a type. */
	tag: string;
	text: string;
	/** The app speaking, such as `Already included.` */
	note?: string;
}

export interface Roster {
	title: string;
	name: string;
	/** `Wyrdcry • Clan Eshin`. */
	subtitle: string;
	/** Fighters, what is left to spend, value – each a heading and its figure. */
	figures: { label: string; value: string }[];
	/** What the warband picked under its faction's choices: `(Origin) The Hunt Descends`. */
	picks: string[];
	statLabels: string[];
	weaponLabels: string[];
	/** The heading over the cost column: `gc`, `silver`. */
	currency: string;
	fighters: RosterFighter[];
	rules: RosterRule[];
}

/* Whatever has no place here first – a choice such as Origin – then the
   faction's rules, the fighters' own by type, and what the gear brings. */
const RULE_ORDER = ['Faction rule', 'Ability', 'Trait', 'Double', 'Triple', 'Quad', 'Reaction', 'Weapon rule', 'Item'];

/** The tag of a rule whose label names no type, by the place it comes from. */
const FALLBACK_TAG: Record<string, string> = {
	'Faction rule': '(Faction Rule)',
	'Weapon rule': '(Weapon Rule)',
	Item: '(Item)'
};

function entries(card: FighterCardData, kind: string): CardEntry[] {
	return card.sections.filter((s) => s.kind === kind).flatMap((s) => s.entries);
}

function toFighter(card: FighterCardData): RosterFighter {
	return {
		name: card.name,
		type: card.subtitle,
		stats: card.stats.map((s) => s.value),
		cost: card.campaign.find((v) => v.key === 'cost')?.value ?? '',
		keywords: card.keywords.join(', '),
		abilities: entries(card, 'fighter').map((e) => e.label),
		weapons: card.weapons.map((w) => ({ name: w.name, values: w.values })),
		items: entries(card, 'equipment')
			.map((e) => e.label)
			.join(', ')
	};
}

/**
 * Every rule once. A label in brackets names its type, `[Triple] Murder-Stab`;
 * one in parentheses the choice it was picked under, `(Origin) The Hunt
 * Descends`. One without either takes the type of the place it comes from.
 */
function collectRules(cards: FighterCardData[]): RosterRule[] {
	const rules = new Map<string, Omit<RosterRule, 'fighters'> & { carriers: string[]; weapons: string[] }>();

	const add = (entry: CardEntry, fallback: string, carrier: string, weapon?: string) => {
		const match = entry.label.match(/^([[(])([^\])]+)[\])]\s*(.*)$/);
		const type = match ? match[2] : fallback;
		const name = match ? match[3] : entry.label;
		const tag = match ? (match[1] === '[' ? `[${type}]` : `(${type})`) : (FALLBACK_TAG[fallback] ?? '');
		const key = `${type}|${name}`;
		const rule = rules.get(key) ?? { name, type, tag, text: entry.text, note: entry.note, carriers: [], weapons: [] };
		if (!rule.carriers.includes(carrier)) rule.carriers.push(carrier);
		if (weapon && !rule.weapons.includes(weapon)) rule.weapons.push(weapon);
		rules.set(key, rule);
	};

	for (const card of cards) {
		for (const e of entries(card, 'faction')) add(e, 'Faction rule', card.instanceId);
		for (const e of entries(card, 'fighter')) add(e, 'Ability', card.instanceId);
		for (const weapon of card.weapons) {
			/* The row's name carries the count, `Sword ×2`; the rule belongs to the sword. */
			const name = weapon.name.replace(/ ×\d+$/, '');
			for (const e of weapon.explanation?.rules ?? []) add(e, 'Weapon rule', card.instanceId, name);
		}
		for (const e of entries(card, 'equipment')) if (e.text) add(e, 'Item', card.instanceId);
	}

	/* The card's `Unnamed fighter` would not tell two fighters apart in a list. */
	const names = new Map(cards.map((c) => [c.instanceId, c.unnamed ? `Unnamed ${c.subtitle}` : c.name]));

	return [...rules.values()]
		.sort((a, b) => RULE_ORDER.indexOf(a.type) - RULE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name))
		.map(({ carriers, weapons, ...rule }) => ({
			...rule,
			fighters: carriers.length === cards.length ? 'Everyone' : carriers.map((id) => names.get(id)).join(', '),
			tag: weapons.length ? `(Weapon Rule: ${weapons.sort((a, b) => a.localeCompare(b)).join(', ')})` : rule.tag
		}));
}

export function toRoster(warband: Warband, faction: Faction, game: GameSystem): Roster {
	const card: WarbandCardData = warbandCard(warband, faction, game);
	const fighters = warband.fighters.map((f) => fighterCard(f, faction, game, warband.picks));

	return {
		title: game.roster.title,
		/* The faction's name stands in, as the file is named after it too. */
		name: card.unnamed ? faction.name : card.name,
		subtitle: card.subtitle,
		figures: card.tables.flat().map((v) => ({ label: v.label, value: v.value })),
		picks: card.picks.map((p) => p.label),
		statLabels: game.roster.stats,
		weaponLabels: game.roster.weapons,
		currency: game.currency,
		fighters: fighters.map(toFighter),
		rules: collectRules(fighters)
	};
}
