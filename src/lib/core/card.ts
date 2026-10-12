/**
 * A warband and its fighters as cards, laid out as the Wyrdcry Warband Deck lays
 * out its own. A fighter's: name and type, keywords, the profile, the cost, the
 * weapons, then the rules in paragraphs. Looked up from the faction and
 * formatted once, so the card and the roster print read the same.
 */

import type { Faction, Fighter, FighterInstance, GameSystem, Rule, Wargear, Warband } from './types';
import { purse, warbandCost } from './validate';
import { chosenOptions, fighterCost, fighterSections, fighterType, formatStat, profileOf } from './warband';

/** One column of a value table: the label above, its value below. */
export interface CardValue {
	key: string;
	label: string;
	/** For a narrow card, where the label does not fit its column: `Init`. */
	short?: string;
	value: string;
}

/** One paragraph below the tables: a bold label, then the text. */
export interface CardEntry {
	/** `[Triple] Running Death`, `(Origin) Aristocrats of Blood`, `Shield`. */
	label: string;
	/** Empty where the game gives the thing no text of its own. */
	text: string;
	/** The app speaking rather than the rules, after the text: `Already included.` */
	note?: string;
}

/** What tapping a weapon's name opens: its profile in short and its rules in full. */
export interface CardExplanation {
	title: string;
	facts: { label: string; value: string }[];
	rules: CardEntry[];
}

export interface CardWeapon {
	/** With the count where the fighter carries more than one: `Dagger ×2`. */
	name: string;
	/** In the order of the game's `weaponStats`. */
	values: string[];
	/** Set where the weapon has rules. */
	explanation?: CardExplanation;
}

/**
 * A run of entries with one origin. The fighter's own come open; faction and
 * universal rules are reference and fold away under a title.
 */
export interface CardSection {
	kind: 'fighter' | 'equipment' | 'faction' | 'universal' | 'universal-reaction' | 'notes';
	entries: CardEntry[];
}

export interface FighterCardData {
	kind: 'fighter';
	instanceId: string;
	/** The fighter's own name, else `Unnamed fighter`. */
	name: string;
	/** Set where the fighter has no name of its own; the card then leads to where it is named. */
	unnamed: boolean;
	/** The fighter's type. */
	subtitle: string;
	/** Readable: `clan eshin`, not `clan-eshin`. */
	keywords: string[];
	stats: CardValue[];
	/** The stat damage counts down, with its figure – 0 where the profile has none. */
	health: { key: string; value: number };
	/** What the fighter carries out of a game rather than into one; for now its cost. */
	campaign: CardValue[];
	weapons: CardWeapon[];
	sections: CardSection[];
	/** The player's own background text, empty where there is none. */
	fluff: string;
	/** Set where the faction no longer has the fighter's type. */
	unknown: boolean;
}

/** In the order the Warband Deck lists abilities; a type it does not know comes first. */
const TYPE_ORDER = ['trait', 'double', 'triple', 'quad', 'reaction'];
const REACTION = 'reaction';

const typeRank = (type = '') => TYPE_ORDER.indexOf(type.toLowerCase());
const titleCase = (word: string) => word[0].toUpperCase() + word.slice(1).toLowerCase();

/** Grouped by type, within a type by name, each labelled with its type: `[Double] Rush`. A note goes to the rule of its name. */
function ruleEntries(rules: Rule[], notes = new Map<string, string>()): CardEntry[] {
	return [...rules]
		.sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.name.localeCompare(b.name))
		.map((r) => ({ label: r.type ? `[${titleCase(r.type)}] ${r.name}` : r.name, text: r.text, note: notes.get(r.name) }));
}

/** Each piece once, in the order it is first carried, with how many there are. */
function counted(ids: string[], faction: Faction): { wargear: Wargear; count: number }[] {
	const result = new Map<string, { wargear: Wargear; count: number }>();
	for (const id of ids) {
		const known = result.get(id);
		if (known) known.count += 1;
		else result.set(id, { wargear: faction.wargear.find((w) => w.id === id) ?? { id, name: id, kind: 'item', cost: 0 }, count: 1 });
	}
	return [...result.values()];
}

const times = (name: string, count: number) => (count > 1 ? `${name} ×${count}` : name);

export function fighterCard(instance: FighterInstance, faction: Faction, game: GameSystem, picks: Record<string, string[]> = {}): FighterCardData {
	const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
	const type = fighter?.name ?? instance.fighterId;
	const options = fighter ? chosenOptions(instance, fighter) : [];
	const carried = counted([...(fighter?.gear ?? []), ...options.flatMap((o) => o.gear ?? []), ...instance.wargear], faction);

	/* Melee ahead of ranged, otherwise in the order they are carried. */
	const weapons = carried
		.filter(({ wargear }) => wargear.kind === 'melee' || wargear.kind === 'ranged')
		.sort((a, b) => Number(a.wargear.kind === 'ranged') - Number(b.wargear.kind === 'ranged'))
		.map(({ wargear, count }): CardWeapon => {
			/* The extra attack belongs to the weapon in hand, so it is the row's own number. */
			const dual = count > 1 && wargear.kind === 'melee' ? game.dualWielding : undefined;
			const values = game.weaponStats.map((s) => {
				const value = wargear.profile?.[s.key] ?? '–';
				return dual?.stat === s.key && /^\d+$/.test(value) ? String(Number(value) + 1) : value;
			});
			const rules = [...(wargear.rules ?? []), ...(dual ? [dual.rule] : [])]
				.map((r) => ({ label: r.name, text: r.text }))
				.sort((a, b) => a.label.localeCompare(b.label));
			const name = times(wargear.name, count);
			return {
				name,
				values,
				explanation: rules.length
					? { title: name, facts: game.weaponStats.map((s, i) => ({ label: s.label, value: values[i] })), rules }
					: undefined
			};
		});

	const items = carried
		.filter(({ wargear }) => wargear.kind === 'armour' || wargear.kind === 'item')
		.map(({ wargear, count }) => ({ label: times(wargear.name, count), text: wargear.text ?? '' }));

	/* The faction's standing rules, then what the warband picked under its choices. */
	const factionRules: CardEntry[] = [
		...faction.rules.map((r) => ({ label: r.name, text: r.text })),
		...faction.choices.flatMap((c) =>
			c.options.filter((o) => picks[c.id]?.includes(o.id)).map((o) => ({ label: `(${c.name}) ${o.name}`, text: o.text }))
		)
	];

	const keywords = [...new Set([...(fighter?.keywords ?? []), ...options.flatMap((o) => o.keywords ?? [])])];
	const universal = game.universal.filter((u) => u.keyword === 'any' || keywords.includes(u.keyword));

	/* A pick that raises a characteristic is in the profile above, and the rule
	   it comes out of says so. Any other pick – a spell, a mutation – is a rule
	   of the fighter's own. */
	const raised = options.some((o) => o.bonus) ? fighter?.choice?.source : undefined;
	const fighterRules = ruleEntries(
		[...(fighter?.rules ?? []), ...options.filter((o) => !o.bonus).map((o) => ({ name: o.name, text: o.text, type: o.type }))],
		new Map(raised ? [[raised, 'Already included.']] : [])
	);

	const sections: CardSection[] = (
		[
			{ kind: 'fighter', entries: fighterRules },
			{ kind: 'equipment', entries: items },
			{ kind: 'faction', entries: factionRules },
			{ kind: 'universal', entries: ruleEntries(universal.filter((u) => u.type !== REACTION)) },
			{ kind: 'universal-reaction', entries: ruleEntries(universal.filter((u) => u.type === REACTION)) },
			/* The player's own text, not the game's – the card gives it its own ground. */
			{ kind: 'notes', entries: instance.notes?.trim() ? [{ label: 'Notes', text: instance.notes.trim() }] : [] }
		] satisfies CardSection[]
	).filter((s) => s.entries.length);

	const profile = fighter ? profileOf(instance, fighter) : undefined;

	return {
		kind: 'fighter',
		instanceId: instance.instanceId,
		name: instance.name.trim() || 'Unnamed fighter',
		unnamed: !instance.name.trim(),
		subtitle: type,
		keywords: keywords.map((k) => k.replaceAll('-', ' ')),
		stats: game.stats.map((s) => ({
			key: s.key,
			label: s.label,
			short: s.short,
			value: formatStat(s, profile?.[s.key])
		})),
		health: {
			key: game.health,
			value: typeof profile?.[game.health] === 'number' ? (profile[game.health] as number) : 0
		},
		campaign: [{ key: 'cost', label: game.costLabel, value: String(fighterCost(instance, faction)) }],
		weapons,
		sections,
		fluff: instance.fluff?.trim() ?? '',
		unknown: !fighter
	};
}

/** A fighter as the warband card lists it: tapping the entry leads to its own card. */
export interface RosterEntry {
	instanceId: string;
	/** The fighter's own name, else `Unnamed fighter`. */
	name: string;
	/** The fighter's type. */
	type: string;
	/** Marked where no heading already says so. */
	leader: boolean;
}

/**
 * The warband itself as a card, laid out as the Warband Deck's: the name, game
 * and faction in the banderole, the player's fluff, what the warband has and is
 * worth, what it picked under its faction's choices, its fighters under the
 * headings of the recruit list, and the notes.
 */
export interface WarbandCardData {
	kind: 'warband';
	/** The deck addresses every card by this; the warband's own id. */
	instanceId: string;
	/** The warband's own name, else `Unnamed warband`. */
	name: string;
	/** Set where the warband has no name of its own; the card then leads to where it is named. */
	unnamed: boolean;
	/** `Wyrdcry • Clan Eshin` under the name. */
	subtitle: string;
	/** Two boxes side by side, each a column of label and value. */
	tables: CardValue[][];
	/** `(Origin) The Hunt Descends`, with the option's text. */
	picks: CardEntry[];
	/** A heading of null where the game lists its fighters as one. */
	roster: { title: string | null; entries: RosterEntry[] }[];
	fluff: string;
	notes: string;
}

export type DeckCard = WarbandCardData | FighterCardData;

export function warbandCard(warband: Warband, faction: Faction, game: GameSystem): WarbandCardData {
	const cost = warbandCost(warband, faction);
	const entry = (instance: FighterInstance, leader = false): RosterEntry => ({
		instanceId: instance.instanceId,
		name: instance.name.trim() || 'Unnamed fighter',
		type: fighterType(instance, faction),
		leader
	});
	const of = (fighters: Fighter[]) => warband.fighters.filter((i) => fighters.some((f) => f.id === i.fighterId));

	/* Fighters in the order of the headings, within one in the order the warband
	   keeps them. Where the headings are roles, as Wyrdcry's, the leader stands
	   first among the heroes, marked, as on the Warband Deck's card; a game that
	   counts its leaders as a group of its own, as Black Death City, keeps it. */
	const sections = fighterSections(faction, game);
	const leaderTitle = game.groups.length ? null : game.roleLabels?.leader;
	const leaders = sections.find((s) => leaderTitle && s.title === leaderTitle);
	const roster = sections
		.filter((section) => section !== leaders)
		.map((section, i) => ({
			title: section.title,
			entries: [
				...(leaders && i === 0 ? of(leaders.fighters).map((f) => entry(f, true)) : []),
				...of(section.fighters).map((f) => entry(f))
			]
		}))
		.filter((group) => group.entries.length);
	const placed = new Set(roster.flatMap((g) => g.entries.map((e) => e.instanceId)));
	const unknown = warband.fighters.filter((i) => !placed.has(i.instanceId)).map((f) => entry(f));

	/* A name that is only the faction's is no name of the warband's own. */
	const own = warband.name.trim();
	const unnamed = !own || own === faction.name;

	return {
		kind: 'warband',
		instanceId: warband.id,
		name: unnamed ? 'Unnamed warband' : own,
		unnamed,
		subtitle: `${game.name} • ${faction.name}`,
		tables: [
			[
				/* As on the Warband Deck's card: how many there are of how many the warband may have. */
				{
					key: 'fighters',
					label: 'Fighters',
					value:
						faction.size.max === null
							? String(warband.fighters.length)
							: `${warband.fighters.length} / ${faction.size.max}`
				}
			],
			[
				/* As on the Warband Deck's card: what is left to spend, and what the warband is worth. */
				{ key: 'left', label: game.costLabel, value: String(Math.max(0, purse(warband, game) - cost)) },
				{ key: 'value', label: 'Value', value: String(cost) }
			]
		],
		picks: faction.choices.flatMap((c) =>
			c.options.filter((o) => warband.picks[c.id]?.includes(o.id)).map((o) => ({ label: `(${c.name}) ${o.name}`, text: o.text }))
		),
		roster: unknown.length ? [...roster, { title: 'Other', entries: unknown }] : roster,
		fluff: warband.fluff?.trim() ?? '',
		notes: warband.notes?.trim() ?? ''
	};
}
