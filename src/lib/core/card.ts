/**
 * A fighter of a warband as a card, laid out as the Wyrdcry Warband Deck lays
 * out its own: name and type, keywords, the profile, the cost, the weapons,
 * then the rules in paragraphs. Looked up from the faction and formatted once,
 * so the card and the roster print read the same.
 */

import type { Faction, FighterInstance, GameSystem, Rule, Wargear } from './types';
import { fighterCost, formatStat } from './warband';

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
	kind: 'fighter' | 'equipment' | 'faction' | 'universal' | 'universal-reaction';
	entries: CardEntry[];
}

export interface FighterCardData {
	instanceId: string;
	/** The fighter's own name, else its type's. */
	name: string;
	/** The type, where the fighter has a name of its own. */
	subtitle: string;
	/** Readable: `clan eshin`, not `clan-eshin`. */
	keywords: string[];
	stats: CardValue[];
	/** What the fighter carries out of a game rather than into one; for now its cost. */
	campaign: CardValue[];
	weapons: CardWeapon[];
	sections: CardSection[];
	/** Set where the faction no longer has the fighter's type. */
	unknown: boolean;
}

/** In the order the Warband Deck lists abilities; a type it does not know comes first. */
const TYPE_ORDER = ['trait', 'double', 'triple', 'quad', 'reaction'];
const REACTION = 'reaction';

const typeRank = (type = '') => TYPE_ORDER.indexOf(type.toLowerCase());
const titleCase = (word: string) => word[0].toUpperCase() + word.slice(1).toLowerCase();

/** Grouped by type, within a type by name, each labelled with its type: `[Double] Rush`. */
function ruleEntries(rules: Rule[]): CardEntry[] {
	return [...rules]
		.sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.name.localeCompare(b.name))
		.map((r) => ({ label: r.type ? `[${titleCase(r.type)}] ${r.name}` : r.name, text: r.text }));
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
	const own = instance.name.trim();
	const carried = counted([...(fighter?.gear ?? []), ...instance.wargear], faction);

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

	const keywords = fighter?.keywords ?? [];
	const universal = game.universal.filter((u) => u.keyword === 'any' || keywords.includes(u.keyword));

	const sections: CardSection[] = (
		[
			{ kind: 'fighter', entries: ruleEntries(fighter?.rules ?? []) },
			{ kind: 'equipment', entries: items },
			{ kind: 'faction', entries: factionRules },
			{ kind: 'universal', entries: ruleEntries(universal.filter((u) => u.type !== REACTION)) },
			{ kind: 'universal-reaction', entries: ruleEntries(universal.filter((u) => u.type === REACTION)) }
		] satisfies CardSection[]
	).filter((s) => s.entries.length);

	return {
		instanceId: instance.instanceId,
		name: own || type,
		subtitle: own ? type : '',
		keywords: keywords.map((k) => k.replaceAll('-', ' ')),
		stats: game.stats.map((s) => ({
			key: s.key,
			label: s.label,
			short: s.short,
			value: formatStat(s, fighter?.profile[s.key])
		})),
		campaign: [{ key: 'cost', label: game.costLabel, value: String(fighterCost(instance, faction)) }],
		weapons,
		sections,
		unknown: !fighter
	};
}
