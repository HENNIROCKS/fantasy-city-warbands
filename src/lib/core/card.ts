/**
 * A warband and its fighters as cards, laid out as the Wyrdcry Warband Deck lays
 * out its own. A fighter's: name and type, keywords, the profile, the cost, the
 * weapons, then the rules in paragraphs. Looked up from the faction and
 * formatted once, so the card and the roster print read the same.
 */

import type { AdvanceEffects, AwayReason, Faction, Fighter, FighterChoiceOption, FighterInstance, GameSystem, Rule, StatFormat, Wargear, Warband } from './types';
import { LEADER, activeEffects, pickedStats, reaches, type ActiveEffect } from './effects';
import { keywordsOf } from './leader';
import { RESULT_LABELS, displayDate, newestFirst, opponent, results, tally } from './history';
import { purse, warbandCost } from './validate';
import { chosenOptions, fighterCost, fighterSections, fighterType, formatStat, profileOf } from './warband';

/** Why a fighter sits out, as its card's band and the back of its card say it. */
export const AWAY_LABELS: Record<AwayReason, string> = {
	'miss-next-battle': 'Misses the next battle',
	captured: 'Captured',
	dead: 'Dead'
};

/** One column of a value table: the label above, its value below. */
export interface CardValue {
	key: string;
	label: string;
	/** For a narrow card, where the label does not fit its column: `Init`. */
	short?: string;
	value: string;
	/** The figure behind `value` and how it is written, where something in play can move it. */
	amount?: number;
	format?: StatFormat;
	/** What the figure is made of, the profile first. Only on a fighter's characteristics. */
	layers?: StatLayer[];
	/** The game's `statFloor`, for whoever adds the battle's layers on top. */
	floor?: number;
	/** What changes the figure in one situation only, beside it rather than in it. */
	conditions?: CardCondition[];
	/** Opened when the value is tapped. */
	explanation?: CardExplanation;
}

/**
 * One contribution to a characteristic, as the Warband Deck's card shows it.
 * The base layer carries the profile value, every other layer the signed amount
 * it adds; `damage` and `battle` are the battle's own.
 */
export interface StatLayer {
	kind: 'base' | 'permanent' | 'equipment' | 'damage' | 'battle' | 'floor';
	/** Named the way the card names it: `Profile`, `Heavy Armour`, `Renown 2`. */
	source: string;
	amount: number;
}

/**
 * The layers with the game's floor kept: where they take a characteristic
 * below it, a layer of its own makes up the difference, so the explanation
 * still adds up. A floor layer already among them is worked out anew, and a
 * profile that starts below the floor keeps its own figure. Damage belongs
 * after this, not in it.
 */
export function floored(layers: StatLayer[], floor: number | undefined): StatLayer[] {
	const rest = layers.filter((l) => l.kind !== 'floor');
	const base = rest.find((l) => l.kind === 'base')?.amount ?? 0;
	const total = rest.reduce((sum, l) => sum + l.amount, 0);
	if (floor === undefined || base < floor || total >= floor) return rest;
	return [...rest, { kind: 'floor', source: `Not below ${floor}`, amount: floor - total }];
}

/** A rule that can change a characteristic without being counted into it, by what it hangs on. */
export interface CardCondition {
	/** Where the rule hangs: a weapon, an item, a state of the battle. */
	source: string;
	name: string;
	text: string;
	amount?: number;
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

/**
 * What tapping a weapon's name or a characteristic opens: a weapon's profile in
 * short and its rules in full, or how a figure is made up and what can still
 * change it.
 */
export interface CardExplanation {
	title: string;
	/** What the card shows, spelled the way the card spells it: `6`, `4"`. */
	result?: string;
	facts?: { label: string; value: string }[];
	layers?: StatLayer[];
	conditions?: CardCondition[];
	rules?: CardEntry[];
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
	kind: 'fighter' | 'equipment' | 'faction' | 'universal-action' | 'universal' | 'universal-reaction' | 'notes';
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
	/** As the rules write them, `hired-sword`, for what a battle asks of the fighter by keyword. */
	keywordIds: string[];
	stats: CardValue[];
	/** The stat damage counts down, with its figure – 0 where the profile has none. */
	health: { key: string; value: number };
	/** What the fighter carries out of a game rather than into one; for now its cost. */
	campaign: CardValue[];
	weapons: CardWeapon[];
	sections: CardSection[];
	/** The player's own background text, empty where there is none. */
	fluff: string;
	/** Why the fighter sits out, for the band across its card; null where it does not. */
	away: string | null;
	/** Set where the faction no longer has the fighter's type. */
	unknown: boolean;
	/** Hired for the battle running, not on the roster: it counts toward no morale and has no back to write on. */
	hired?: true;
	/** What it counts for when the warband's morale is judged: 1, or less where a faction rule says so. */
	weight: number;
}

/** In the order the Warband Deck lists abilities, injuries after the traits; a type it does not know comes first. */
const TYPE_ORDER = ['trait', 'injury', 'double', 'triple', 'quad', 'reaction'];
const REACTION = 'reaction';
/* An action any fighter of a keyword can make, such as a WIZARD's Channel Magic: a heading of its own, as the rules set actions apart from abilities. */
const ACTION = 'action';

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
	const effects = activeEffects({ picks }, faction);
	/* What the fighter's spent levels bring besides characteristics. */
	const advanced = fighter && game.advancement ? game.advancement.effects(instance, fighter, faction) : { rules: [], keywords: [], weapons: [], stats: [] };
	/* What the injuries it keeps do to it. */
	const injured = fighter && game.injuries ? game.injuries.effects(instance, fighter, faction) : { rules: [], keywords: [], weapons: [], stats: [], forbid: [] };
	const changed = [...advanced.weapons, ...injured.weapons];
	const carried = counted([...(fighter?.gear ?? []), ...options.flatMap((o) => o.gear ?? []), ...instance.wargear], faction);

	/* Ranged ahead of melee, otherwise in the order they are carried. */
	const weapons = carried
		.filter(({ wargear }) => wargear.kind === 'melee' || wargear.kind === 'ranged')
		.sort((a, b) => Number(a.wargear.kind === 'melee') - Number(b.wargear.kind === 'melee'))
		.map(({ wargear, count }): CardWeapon => {
			/* The extra attack belongs to the weapon in hand, so it is the row's own number. */
			const dual = count > 1 && wargear.kind === 'melee' ? game.dualWielding : undefined;
			/* A level spent on this weapon, such as a heroic talent's point of critical damage, or an injury's cut to its reach. */
			const raised = changed.filter((w) => w.wargear === wargear.id);
			const values = game.weaponStats.map((s) => {
				const own = raised.find((w) => w.stat === s.key)?.value;
				const value = own ?? wargear.profile?.[s.key] ?? '–';
				return dual?.stat === s.key && /^\d+$/.test(value) ? String(Number(value) + 1) : value;
			});
			const rules = [
				...(wargear.rules ?? []),
				...(dual ? [dual.rule] : []),
				...raised.map((w) => ({ name: w.source, text: `Counted into the ${game.weaponStats.find((s) => s.key === w.stat)?.label ?? w.stat} above.` }))
			]
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

	/* As the levels make them – a henchman with three of Wyrdcry's renown is a HERO – and LEADER for one that took the lead. */
	const keywords = [
		...new Set([...(fighter ? keywordsOf(instance, fighter, game) : instance.leader ? [LEADER] : []), ...advanced.keywords, ...injured.keywords])
	];

	/* The faction's standing rules, then what the warband picked under its
	   choices. A rule that leaves this fighter out keeps its line, with a hint
	   where its text would stand – Sudden Accusation on a War Hound. A pick that
	   raises this fighter's characteristics says it is in the profile above. */
	const named = (keyword: string) => `\`${keyword.replaceAll('-', ' ').toUpperCase()}\``;
	const factionRules: CardEntry[] = [
		...faction.rules.map((r) => ({
			label: r.name,
			text:
				r.except && keywords.includes(r.except)
					? `Does not apply to a ${named(r.except)}.`
					: r.only && !keywords.includes(r.only)
						? `Applies only to a ${named(r.only)}.`
						: r.text
		})),
		...faction.choices.flatMap((c) =>
			c.options
				.filter((o) => picks[c.id]?.includes(o.id))
				.map((o) => ({
					label: `(${c.name}) ${o.name}`,
					text: o.text,
					...(fighter && o.effect?.stats?.some((s) => reaches(s, fighter.id)) ? { note: 'Already included.' } : {})
				}))
		)
	];
	const universal = game.universal.filter((u) => u.keyword === 'any' || keywords.includes(u.keyword));

	/* A fighter with no melee weapon in hand fights with the game's Unarmed
	   profile, where the melee weapons stand: after the ranged ones – where its
	   profile is known, since only that says what it carries. */
	const unarmed = game.unarmed;
	if (unarmed && fighter && !carried.some(({ wargear }) => wargear.kind === 'melee') && !keywords.some((k) => unarmed.except.includes(k))) {
		weapons.push({ name: unarmed.weapon.name, values: game.weaponStats.map((s) => unarmed.weapon.profile?.[s.key] ?? '–') });
	}

	/* A pick that only raises a characteristic is in the profile above, and the
	   rule it comes out of says so. Any other pick – a spell, a mutation, even
	   one that raises a characteristic as well – is a rule of the fighter's own. */
	const raises = (o: FighterChoiceOption) => o.bonus && !o.text;
	const raised = options.some(raises) ? fighter?.choice?.source : undefined;
	const ownRules = [
		...(fighter?.rules ?? []),
		...options.filter((o) => !raises(o)).map((o) => ({ name: o.name, text: o.text, type: o.type })),
		...advanced.rules,
		...injured.rules
	];
	/* An injury that bars a type of ability, as Alcoholic bars reactions, leaves
	   them on the card and says so under each. */
	const barred = (rules: Rule[]) =>
		rules.flatMap((r) => {
			const by = injured.forbid.find((f) => f.type === r.type?.toLowerCase());
			return by ? [[r.name, `Cannot be used: ${by.source}.`] as const] : [];
		});
	const fighterRules = ruleEntries(ownRules, new Map([...(raised ? [[raised, 'Already included.'] as const] : []), ...barred(ownRules)]));
	const universalReactions = universal.filter((u) => u.type === REACTION);
	const universalActions = universal.filter((u) => u.type === ACTION);

	const sections: CardSection[] = (
		[
			{ kind: 'fighter', entries: fighterRules },
			{ kind: 'equipment', entries: items },
			{ kind: 'faction', entries: factionRules },
			{ kind: 'universal-action', entries: ruleEntries(universalActions, new Map(barred(universalActions))) },
			{ kind: 'universal', entries: ruleEntries(universal.filter((u) => u.type !== REACTION && u.type !== ACTION)) },
			{ kind: 'universal-reaction', entries: ruleEntries(universalReactions, new Map(barred(universalReactions))) },
			/* The player's own text, not the game's – the card gives it its own ground. */
			{ kind: 'notes', entries: instance.notes?.trim() ? [{ label: 'Notes', text: instance.notes.trim() }] : [] }
		] satisfies CardSection[]
	).filter((s) => s.entries.length);

	const profile = fighter ? profileOf(instance, fighter, effects) : undefined;
	const statLayers = fighter ? layersOf(instance, fighter, faction, effects, [...advanced.stats, ...injured.stats]) : new Map<string, StatLayer[]>();
	const statConditions = conditionsOf(carried.map((c) => c.wargear));

	return {
		kind: 'fighter',
		instanceId: instance.instanceId,
		weight: faction.weights?.[instance.fighterId] ?? 1,
		name: instance.name.trim() || 'Unnamed fighter',
		unnamed: !instance.name.trim(),
		subtitle: type,
		keywords: keywords.map((k) => k.replaceAll('-', ' ')),
		keywordIds: keywords,
		stats: game.stats.map((s) => {
			const raw = statLayers.get(s.key);
			if (!raw) return { key: s.key, label: s.label, short: s.short, value: formatStat(s, profile?.[s.key]) };
			const layers = floored(raw, game.statFloor);
			const amount = layers.reduce((sum, layer) => sum + layer.amount, 0);
			return {
				key: s.key,
				label: s.label,
				short: s.short,
				value: formatStat(s, amount),
				amount,
				format: s.format,
				layers,
				floor: game.statFloor,
				conditions: statConditions.get(s.key) ?? []
			};
		}),
		/* With its levels and wargear, as the table counts it, so damage counts down from the same figure. */
		health: {
			key: game.health,
			value: floored(statLayers.get(game.health) ?? [], game.statFloor).reduce((sum, layer) => sum + layer.amount, 0)
		},
		/* As on the Warband Deck's card: what the fighter carries out of a game
		   rather than into one, where the game keeps a campaign. */
		campaign: [
			{ key: 'cost', label: game.costLabel, value: String(fighterCost(instance, faction, effects)) },
			...(game.campaign?.fighter.map((c) => ({ key: c.key, label: c.label, value: String(instance.tally?.[c.key] ?? 0) })) ?? [])
		],
		weapons,
		sections,
		fluff: instance.fluff?.trim() ?? '',
		away: instance.away ? AWAY_LABELS[instance.away] : null,
		unknown: !fighter
	};
}

/**
 * How each numeric characteristic is made up, as the Warband Deck's card has it:
 * the profile, what the fighter's own pick, the warband's picks, its levels, its
 * talents and its injuries add, then what its bought wargear adds whenever it is carried. Wargear on the profile is not
 * counted: the profile already carries it.
 */
function layersOf(
	instance: FighterInstance,
	fighter: Fighter,
	faction: Faction,
	effects: ActiveEffect[],
	rules: AdvanceEffects['stats']
): Map<string, StatLayer[]> {
	const map = new Map<string, StatLayer[]>();
	for (const [key, value] of Object.entries(fighter.profile)) {
		if (typeof value === 'number') map.set(key, [{ kind: 'base', source: 'Profile', amount: value }]);
	}
	const add = (key: string, layer: StatLayer) => {
		if (layer.amount !== 0) map.get(key)?.push(layer);
	};

	const source = fighter.choice?.source;
	for (const option of chosenOptions(instance, fighter)) {
		for (const [key, bonus] of Object.entries(option.bonus ?? {})) add(key, { kind: 'permanent', source: source ?? option.name, amount: bonus });
	}
	for (const { stat, bonus, source } of pickedStats(fighter, effects)) add(stat, { kind: 'permanent', source, amount: bonus });
	for (const advance of instance.advances ?? []) {
		if (!advance.stat) continue;
		add(advance.stat, {
			kind: 'permanent',
			/* A level of 0 is a raise the warband file holds without saying why. */
			source: advance.level > 0 ? `Renown ${advance.level}` : 'Warband file',
			amount: advance.bonus ?? 0
		});
	}
	for (const rule of rules) add(rule.stat, { kind: 'permanent', source: rule.source, amount: rule.bonus });
	/* What it carries from the start counts as what it bought, a hired sword's Heavy Armour as a warrior's. */
	const wargear = new Map(faction.wargear.map((w) => [w.id, w]));
	for (const id of [...fighter.gear, ...instance.wargear]) {
		const piece = wargear.get(id);
		for (const effect of piece?.effects ?? []) add(effect.stat, { kind: 'equipment', source: piece!.name, amount: effect.bonus });
	}
	return map;
}

/**
 * What can change a characteristic in one situation only: the rules of every
 * weapon the fighter has, its profile's and a mutation's included, and the items
 * it carries. A rule two weapons share is named once for each weapon, a second
 * copy of the same weapon adds nothing the first did not say.
 */
function conditionsOf(carried: Wargear[]): Map<string, CardCondition[]> {
	const map = new Map<string, CardCondition[]>();
	const add = (key: string, condition: CardCondition) => {
		const list = map.get(key) ?? [];
		if (!list.some((c) => c.name === condition.name && c.source === condition.source)) map.set(key, [...list, condition]);
	};
	for (const piece of carried) {
		if (piece.kind === 'melee' || piece.kind === 'ranged') {
			for (const rule of piece.rules ?? []) {
				for (const c of rule.conditions ?? []) add(c.stat, { source: piece.name, name: c.name, text: c.text, amount: c.bonus });
			}
		} else {
			for (const c of piece.conditions ?? []) add(c.stat, { source: piece.name, name: c.name, text: c.text, amount: c.bonus });
		}
	}
	return map;
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
	/** A heading of null where the game lists its fighters as one. */
	roster: { title: string | null; entries: RosterEntry[] }[];
	fluff: string;
	/** What the battle running brings besides its fighters, such as the underdog's bonuses; the deck sets it while the battle lasts. */
	reminders?: CardEntry[];
	notes: string;
	/** The battles fought, newest first, as the card lists them. */
	battles: { id: string; date: string; opponent: string; result: string }[];
	/** `2 won · 1 drawn · 0 lost`. */
	tally: string;
	/** The same as figures: won, drawn and lost. */
	results: [number, number, number];
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
	/* A henchman its levels made a HERO stands among the heroes, where the game names them. */
	const heroTitle = game.groups.length ? undefined : game.roleLabels?.hero;
	const promoted = (i: FighterInstance) => {
		const type = faction.fighters.find((f) => f.id === i.fighterId);
		return !!type && !type.keywords.includes('hero') && keywordsOf(i, type, game).includes('hero');
	};
	/* Where the leader is marked first among the heroes, a fighter that took the lead stands there, not under its own heading. */
	const leaderTitle = game.groups.length ? null : game.roleLabels?.leader;
	const of = (fighters: Fighter[], title: string | null = null) =>
		warband.fighters.filter(
			(i) =>
				!(leaderTitle && i.leader) &&
				((fighters.some((f) => f.id === i.fighterId) && !(heroTitle && promoted(i))) ||
					(heroTitle !== undefined && title === heroTitle && promoted(i)))
		);

	/* Fighters in the order of the headings, within one in the order the warband
	   keeps them. Where the headings are roles, as Wyrdcry's, the leader stands
	   first among the heroes, marked, as on the Warband Deck's card; a game that
	   counts its leaders as a group of its own, as Black Death City, keeps it. */
	const sections = fighterSections(faction, game);
	const leaders = sections.find((s) => leaderTitle && s.title === leaderTitle);
	const led = leaderTitle ? warband.fighters.filter((i) => i.leader) : [];
	const roster = sections
		.filter((section) => section !== leaders)
		.map((section, i) => ({
			title: section.title,
			entries: [
				...(i === 0 ? [...(leaders ? of(leaders.fighters) : []), ...led].map((f) => entry(f, true)) : []),
				...of(section.fighters, section.title).map((f) => entry(f))
			]
		}))
		.filter((group) => group.entries.length);
	const placed = new Set(roster.flatMap((g) => g.entries.map((e) => e.instanceId)));
	const unknown = warband.fighters.filter((i) => !placed.has(i.instanceId)).map((f) => entry(f));

	const values = game.campaign?.values?.(warband) ?? [];

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
				},
				...values
			],
			[
				/* As on the Warband Deck's card: what is left to spend, and what the warband is worth. */
				{ key: 'left', label: game.costLabel, value: String(Math.max(0, purse(warband, game) - cost)) },
				{ key: 'value', label: 'Value', value: String(cost) }
			]
		],
		roster: unknown.length ? [...roster, { title: 'Other', entries: unknown }] : roster,
		fluff: warband.fluff?.trim() ?? '',
		notes: warband.notes?.trim() ?? '',
		battles: newestFirst(warband.history ?? []).map((record) => ({
			id: record.id,
			date: displayDate(record.date),
			opponent: opponent(record),
			result: RESULT_LABELS[record.result]
		})),
		tally: tally(warband.history ?? []),
		results: results(warband.history ?? [])
	};
}
