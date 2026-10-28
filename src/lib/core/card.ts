/**
 * A warband and its fighters as cards, laid out as the Wyrdcry Warband Deck lays
 * out its own. A fighter's: name and type, keywords, the profile, the cost, the
 * weapons and the items, then the rules in paragraphs. Looked up from the
 * faction and formatted once, so the card and the roster print read the same.
 */

import type { BattleLayer, UsedPiece } from './battle';
import type { AdvanceEffects, AwayReason, Faction, Fighter, FighterChoiceOption, FighterInstance, GameSystem, NextBattle, Rule, StatFormat, Wargear, Warband } from './types';
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
	/** The characteristic's `floor`, else the game's `statFloor`, for whoever adds the battle's layers on top. */
	floor?: number;
	/** What changes the figure in one situation only, beside it rather than in it. */
	conditions?: CardCondition[];
	/** Opened when the value is tapped. */
	explanation?: CardExplanation;
	/** A part of the same card the value stands for, which tapping it scrolls to. */
	target?: 'stash';
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
	/** A faction rule that leaves this fighter out, its text a hint in the rule's place. */
	leftOut?: true;
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
	kind: 'fighter' | 'faction' | 'universal-action' | 'universal' | 'universal-reaction' | 'notes';
	entries: CardEntry[];
}

/** A piece of armour or an item, as the box under the weapons lists it. */
export interface CardItem {
	wargear: string;
	name: string;
	count: number;
	/** Empty where the game gives the piece no text of its own. */
	text: string;
	/** Set where the piece has a text, opened when its name is tapped. */
	explanation?: CardExplanation;
	/**
	 * For a single-use piece, one box for each copy carried: for a copy used in
	 * the battle running, the use's place in the fighter's `used` and the weapon
	 * it was used on by name; null for one not used. The used ones first.
	 */
	copies?: ({ at: number; on?: string } | null)[];
	/** The weapons it can be used on, where using it picks one: those without the rule it gives; empty where none is left. */
	weapons?: { id: string; name: string }[];
}

export interface FighterCardData {
	kind: 'fighter';
	instanceId: string;
	/** The fighter's own name, else `Unnamed fighter`. */
	name: string;
	/** Set where the fighter has no name of its own; the card then leads to where it is named. */
	unnamed: boolean;
	/** The fighter's type, or the role it picked. */
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
	items: CardItem[];
	/**
	 * What the single-use pieces used in the battle running do until it ends:
	 * their names for the card's band, and what they add to the characteristics.
	 */
	inUse: { labels: string[]; layers: BattleLayer[] };
	sections: CardSection[];
	/** The player's own background text, else the one its rules give it; empty where there is neither. */
	fluff: string;
	/** The picture the fighter's data brings, for the image field where there is no photo; null where there is none. */
	image: string | null;
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
/* Each word capitalised, as a rule's type is printed: `Double`, `Bonus Action`. */
const titleCase = (type: string) => type.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

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

/** The wargear ids a fighter carries, a copy each: its profile's, its pick's, then what it bought. */
export function carriedIds(instance: FighterInstance, faction: Faction): string[] {
	const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
	const options = fighter ? chosenOptions(instance, fighter) : [];
	return [...(fighter?.gear ?? []), ...options.flatMap((o) => o.gear ?? []), ...instance.wargear];
}

/**
 * The uses that still hold, each with its place in `used`: of a single-use
 * piece the fighter carries, no more than it carries copies, and on a weapon it
 * still holds where the piece picks one. `carried` are the wargear ids it
 * carries, a copy each.
 */
export function heldUses(used: UsedPiece[], carried: string[], faction: Faction): (UsedPiece & { at: number })[] {
	const left = new Map<string, number>();
	for (const id of carried) left.set(id, (left.get(id) ?? 0) + 1);
	return used.flatMap((use, at) => {
		const piece = faction.wargear.find((w) => w.id === use.wargear);
		if (!piece?.singleUse || !left.get(use.wargear)) return [];
		if (piece.used?.weapon && !(use.on && carried.includes(use.on))) return [];
		left.set(use.wargear, left.get(use.wargear)! - 1);
		return [{ ...use, at }];
	});
}

/**
 * `used` are the single-use pieces the fighter used in the battle running and
 * `rolled` what it rolled before it, `next` what the warband's last exploring
 * left for its next battle.
 */
export function fighterCard(
	instance: FighterInstance,
	faction: Faction,
	game: GameSystem,
	picks: Record<string, string[]> = {},
	used: UsedPiece[] = [],
	next: NextBattle[] = [],
	rolled: Record<string, number> = {}
): FighterCardData {
	const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
	const type = fighter?.name ?? instance.fighterId;
	const options = fighter ? chosenOptions(instance, fighter) : [];
	const effects = activeEffects({ picks }, faction);
	/* What the fighter's spent levels bring besides characteristics. */
	const advanced = fighter && game.advancement ? game.advancement.effects(instance, fighter, faction) : { rules: [], keywords: [], weapons: [], stats: [] };
	/* What the injuries it keeps do to it. */
	const injured = fighter && game.injuries ? game.injuries.effects(instance, fighter, faction) : { rules: [], keywords: [], weapons: [], stats: [], forbid: [] };
	const changed = [...advanced.weapons, ...injured.weapons];
	const ids = carriedIds(instance, faction);
	const carried = counted(ids, faction);
	/* The single-use pieces used, each with what it does until the battle ends. */
	const uses = heldUses(used, ids, faction).map((use) => ({ ...use, piece: faction.wargear.find((w) => w.id === use.wargear)! }));
	const stripped = uses.flatMap(({ piece }) => (piece.used?.strips ? [{ rule: piece.used.strips, source: piece.name }] : []));
	const nameOf = (id: string) => faction.wargear.find((w) => w.id === id)?.name ?? id;

	/* Ranged ahead of melee, otherwise in the order they are carried. */
	const weapons = carried
		.filter(({ wargear }) => wargear.kind === 'melee' || wargear.kind === 'ranged')
		.sort((a, b) => Number(a.wargear.kind === 'melee') - Number(b.wargear.kind === 'melee'))
		.map(({ wargear, count }): CardWeapon => {
			/* What the game's rules change for what else the fighter carries, such as
			   Dual Wielding's extra attack, belongs to the weapon in hand, so it is the row's own number. */
			const adjusted = game.weaponAdjustments?.(wargear, count, carried.map((c) => c.wargear), faction) ?? [];
			/* A level spent on this weapon, such as a heroic talent's point of critical damage, or an injury's cut to its reach. */
			const raised = changed.filter((w) => w.wargear === wargear.id);
			const values = game.weaponStats.map((s) => {
				const own = raised.find((w) => w.stat === s.key)?.value;
				const value = own ?? wargear.profile?.[s.key] ?? '–';
				const amount = adjusted.filter((a) => a.stat === s.key).reduce((sum, a) => sum + a.amount, 0);
				return amount && /^\d+$/.test(value) ? String(Number(value) + amount) : value;
			});
			/* A rule a single-use piece gave the weapon, and one a piece took off it for the battle, which keeps its line and says so. */
			const own = [...(wargear.rules ?? []), ...adjusted.map((a) => a.rule)];
			const gained = uses
				.flatMap(({ piece, on }) => {
					const rule = on === wargear.id ? piece.used?.weapon?.rule : undefined;
					return rule ? [{ rule, source: piece.name }] : [];
				})
				.filter(({ rule }, i, all) => !own.some((r) => r.name === rule.name) && all.findIndex((g) => g.rule.name === rule.name) === i)
				.map(({ rule, source }) => ({ name: rule.name, text: `${rule.text} From ${source}, until the battle ends.` }));
			const rules = [
				...own,
				...gained,
				...raised.map((w) => ({ name: w.source, text: `Counted into the ${game.weaponStats.find((s) => s.key === w.stat)?.label ?? w.stat} above.` }))
			]
				/* A rule of the game's that changes the row says it is in the row already. */
				.map((r): CardEntry => {
					const off = stripped.find((s) => s.rule === r.name);
					if (off) return { label: r.name, text: `Not in this battle: ${off.source}.` };
					return { label: r.name, text: r.text, ...(adjusted.some((a) => a.rule.name === r.name) ? { note: 'Already included.' } : {}) };
				})
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

	/* Whether a weapon has a rule, its own or one a single-use piece gave it for the battle. */
	const holds = (weapon: Wargear, name: string) =>
		(weapon.rules ?? []).some((r) => r.name === name) || uses.some(({ piece, on }) => on === weapon.id && piece.used?.weapon?.rule.name === name);

	const items = carried
		.filter(({ wargear }) => wargear.kind === 'armour' || wargear.kind === 'item')
		.map(({ wargear, count }): CardItem => {
			const mine = uses.filter((u) => u.wargear === wargear.id);
			const gives = wargear.used?.weapon;
			return {
				wargear: wargear.id,
				name: wargear.name,
				count,
				text: wargear.text ?? '',
				/* What it does whenever it is carried is in the figures already, and its text says so. */
				...(wargear.text
					? {
							explanation: {
								title: wargear.name,
								rules: [
									{
										label: wargear.singleUse ? 'Single use' : wargear.kind === 'armour' ? 'Armour' : 'Item',
										text: wargear.text,
										...(wargear.effects?.length || wargear.sets?.length ? { note: 'Already included.' } : {})
									}
								]
							}
						}
					: {}),
				...(wargear.singleUse
					? { copies: Array.from({ length: count }, (_, i) => (mine[i] ? { at: mine[i].at, ...(mine[i].on ? { on: nameOf(mine[i].on) } : {}) } : null)) }
					: {}),
				/* A weapon that has the rule already gains nothing from it. */
				...(gives
					? {
							weapons: carried
								.filter((c) => gives.kinds.includes(c.wargear.kind) && !holds(c.wargear, gives.rule.name))
								.map((c) => ({ id: c.wargear.id, name: c.wargear.name }))
						}
					: {})
			};
		});

	/* As the levels make them – a henchman with three of Wyrdcry's renown is a HERO – and LEADER for one that took the lead. */
	const keywords = [
		...new Set([...(fighter ? keywordsOf(instance, fighter, game) : instance.leader ? [LEADER] : []), ...advanced.keywords, ...injured.keywords])
	];

	/* The faction's standing rules, then what the warband picked under its
	   choices. A rule that leaves this fighter out keeps its line, with a hint
	   where its text would stand – Sudden Accusation on a War Hound, any of
	   Wyrdcry's on a HIRED SWORD. A pick that raises this fighter's
	   characteristics says it is in the profile above. */
	const named = (keyword: string) => `\`${keyword.replaceAll('-', ' ').toUpperCase()}\``;
	const factionRules: CardEntry[] = [
		...faction.rules.map((r): CardEntry => {
			const left = r.except?.find((k) => keywords.includes(k));
			const hint = left
				? `Does not apply to a ${named(left)}.`
				: r.only && !keywords.includes(r.only)
					? `Applies only to a ${named(r.only)}.`
					: null;
			return hint ? { label: r.name, text: hint, leftOut: true } : { label: r.name, text: r.text };
		}),
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
	const raised = (fighter?.choices ?? []).flatMap((c) => (c.source && c.options.some((o) => raises(o) && options.includes(o)) ? [c.source] : []));
	const standing = [
		...(fighter?.rules ?? []),
		...options.filter((o) => !raises(o)).map((o) => ({ name: o.name, text: o.text, type: o.type })),
		...advanced.rules,
		...injured.rules
	];
	/* A rule a single-use piece gives for the battle, as Mad Cap Mushrooms' Stupidity, unless the fighter has it already. */
	const lent = uses
		.flatMap(({ piece }) => (piece.used?.rules ?? []).map((rule) => ({ rule, source: piece.name })))
		.filter(({ rule }, i, all) => !standing.some((r) => r.name === rule.name) && all.findIndex((l) => l.rule.name === rule.name) === i);
	/* What it rolled before the battle, unless it has that already among its picks, as a signature spell. */
	const prepared = (fighter?.beforeBattle ?? []).flatMap((table) => {
		const option = table.options.find((o) => o.roll === rolled[table.id]);
		if (!option || (instance.picks ?? []).includes(option.id)) return [];
		const rule: Rule = { name: option.name, text: option.text, ...(option.type ? { type: option.type } : {}) };
		return [{ rule, note: `For this battle: rolled ${option.roll} on the ${table.name}.` }];
	});
	const ownRules = [...standing, ...lent.map(({ rule }) => rule), ...prepared.map(({ rule }) => rule)];
	/* An injury that bars a type of ability, as Alcoholic bars reactions, leaves
	   them on the card and says so under each. */
	const barred = (rules: Rule[]) =>
		rules.flatMap((r) => {
			const by = injured.forbid.find((f) => f.type === r.type?.toLowerCase());
			return by ? [[r.name, `Cannot be used: ${by.source}.`] as const] : [];
		});
	/* A talent, an injury or a pick of its own that changes a figure, or a
	   weapon the fighter carries, is in the tables above. A talent taken for a
	   weapon is named after it: Weapon Master (Sword). */
	const shown = [...advanced.weapons, ...injured.weapons].filter((w) => carried.some((c) => c.wargear.id === w.wargear));
	const changing = new Set([
		...[...advanced.stats, ...injured.stats, ...shown].map((c) => c.source),
		...options.filter((o) => o.bonus && !raises(o)).map((o) => o.name)
	]);
	const included = ownRules.filter((r) => changing.has(r.name) || [...changing].some((s) => r.name.startsWith(`${s} (`)));
	const fighterRules = ruleEntries(
		ownRules,
		new Map([
			...raised.map((source) => [source, 'Already included.'] as const),
			...included.map((r) => [r.name, 'Already included.'] as const),
			...lent.map(({ rule, source }) => [rule.name, `For this battle: ${source}.`] as const),
			...prepared.map(({ rule, note }) => [rule.name, note] as const),
			...barred(ownRules)
		])
	);
	const universalReactions = universal.filter((u) => u.type === REACTION);
	const universalActions = universal.filter((u) => u.type === ACTION);

	const sections: CardSection[] = (
		[
			{ kind: 'fighter', entries: fighterRules },
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
	/* What the last exploring left for this battle, such as the Mad Prophet's Bravery, on every fighter. */
	for (const n of next) if (n.stat && n.stat.bonus) statLayers.get(n.stat.key)?.push({ kind: 'battle', source: n.source, amount: n.stat.bonus });
	const statConditions = conditionsOf(carried.map((c) => c.wargear));

	return {
		kind: 'fighter',
		instanceId: instance.instanceId,
		weight: faction.weights?.[instance.fighterId] ?? 1,
		name: instance.name.trim() || 'Unnamed fighter',
		unnamed: !instance.name.trim(),
		/* Named after its role where it picked one: River Troll. */
		subtitle: options.find((o) => o.title)?.title ?? type,
		keywords: keywords.map((k) => k.replaceAll('-', ' ')),
		keywordIds: keywords,
		stats: game.stats.map((s) => {
			const raw = statLayers.get(s.key);
			if (!raw) return { key: s.key, label: s.label, short: s.short, value: formatStat(s, profile?.[s.key]) };
			const layers = floored(raw, s.floor ?? game.statFloor);
			const amount = layers.reduce((sum, layer) => sum + layer.amount, 0);
			return {
				key: s.key,
				label: s.label,
				short: s.short,
				value: formatStat(s, amount),
				amount,
				format: s.format,
				layers,
				floor: s.floor ?? game.statFloor,
				conditions: statConditions.get(s.key) ?? []
			};
		}),
		/* With its levels and wargear, as the table counts it, so damage counts down from the same figure. */
		health: {
			key: game.health,
			value: floored(statLayers.get(game.health) ?? [], game.stats.find((s) => s.key === game.health)?.floor ?? game.statFloor).reduce((sum, layer) => sum + layer.amount, 0)
		},
		/* As on the Warband Deck's card: what the fighter carries out of a game
		   rather than into one, where the game keeps a campaign. */
		campaign: [
			{ key: 'cost', label: game.costLabel, value: String(fighterCost(instance, faction, effects)) },
			...(game.campaign?.fighter.map((c) => ({ key: c.key, label: c.label, value: String(instance.tally?.[c.key] ?? 0) })) ?? [])
		],
		weapons,
		items,
		inUse: {
			labels: [...new Set(uses.filter(({ piece }) => piece.used).map(({ piece }) => piece.name))],
			layers: uses.flatMap(({ piece }) => Object.entries(piece.used?.bonus ?? {}).map(([stat, amount]) => ({ stat, source: piece.name, amount })))
		},
		sections,
		fluff: instance.fluff?.trim() || fighter?.fluff || '',
		image: options.find((o) => o.image)?.image ?? fighter?.image ?? null,
		away: instance.away ? AWAY_LABELS[instance.away] : null,
		unknown: !fighter
	};
}

/**
 * How each numeric characteristic is made up, as the Warband Deck's card has it:
 * the profile, what the fighter's own pick, the warband's picks, its levels, its
 * talents and its injuries add, then what its bought wargear adds whenever it is carried. Wargear on the profile is not
 * counted: the profile already carries it. Wargear that replaces a characteristic,
 * such as Black Death City's armour, comes right after the profile, as what it
 * takes off or puts on, so that everything else adds to the new figure.
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
	/* What it carries from the start counts as what it bought, a hired sword's Heavy Armour as a warrior's. */
	const wargear = new Map(faction.wargear.map((w) => [w.id, w]));
	const pieces = [...fighter.gear, ...instance.wargear].flatMap((id) => wargear.get(id) ?? []);
	for (const piece of pieces) {
		for (const { stat, value } of piece.sets ?? []) {
			const current = map.get(stat)?.reduce((sum, layer) => sum + layer.amount, 0);
			if (current !== undefined) add(stat, { kind: 'equipment', source: piece.name, amount: value - current });
		}
	}

	/* A pick with a text of its own is a rule on the card and named after itself, Hulking Form; a bare
	   characteristic after the rule it comes out of, Martial Discipline. */
	const picks = instance.picks ?? [];
	for (const choice of fighter.choices ?? []) {
		for (const option of choice.options.filter((o) => picks.includes(o.id))) {
			const by = option.text ? option.name : (choice.source ?? option.name);
			for (const [key, bonus] of Object.entries(option.bonus ?? {})) add(key, { kind: 'permanent', source: by, amount: bonus });
		}
	}
	for (const { stat, bonus, source } of pickedStats(fighter, effects)) add(stat, { kind: 'permanent', source, amount: bonus });
	for (const advance of instance.advances ?? []) {
		if (!advance.stat) continue;
		add(advance.stat, {
			kind: 'permanent',
			/* A level of 0 is a change outside renown: one an encounter made, or one the warband file holds without saying why. */
			source: advance.level > 0 ? `Renown ${advance.level}` : (advance.source ?? 'Warband file'),
			amount: advance.bonus ?? 0
		});
	}
	for (const rule of rules) add(rule.stat, { kind: 'permanent', source: rule.source, amount: rule.bonus });
	for (const piece of pieces) {
		for (const effect of piece.effects ?? []) add(effect.stat, { kind: 'equipment', source: piece.name, amount: effect.bonus });
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
	/** `35 gc, Sword, Lucky Charm`: the gold left, then the weapons and the rest in the stash; empty where there is neither. */
	stash: string;
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

	/* As on the Warband Deck's card: the gold left, then the weapons ahead of the
	   rest, each in the order the warband stores them; an id the faction does not
	   know stands there as itself. */
	const left = Math.max(0, purse(warband, game) - cost);
	const pieces = (warband.stash ?? []).map((id) => faction.wargear.find((w) => w.id === id) ?? { name: id, kind: 'item' });
	const weapon = (p: { kind: string }) => p.kind === 'melee' || p.kind === 'ranged';
	const stash = [
		...(left ? [`${left} ${game.currency}`] : []),
		...pieces.filter(weapon).map((p) => p.name),
		...pieces.filter((p) => !weapon(p)).map((p) => p.name)
	].join(', ');

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
				/* As on the Warband Deck's card: what is left to spend, what the warband
				   is worth, and the way to the stash, which holds the gold as well. */
				{ key: 'left', label: game.costLabel, value: String(left) },
				{ key: 'value', label: 'Value', value: String(cost) },
				...(stash ? [{ key: 'stash', label: 'Stash', value: 'View', target: 'stash' as const }] : [])
			]
		],
		roster: unknown.length ? [...roster, { title: 'Other', entries: unknown }] : roster,
		stash,
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
