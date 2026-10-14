/**
 * Spending Wyrdcry's renown, as the Warband Deck's `renown.ts` does: which
 * levels a fighter has open, what each may raise or teach, and what a spent
 * level does to the card. A level spent is an `advance` on the fighter – a
 * characteristic with its bonus, a heroic talent or a magical ability by id,
 * with the weapon a talent was taken for, or neither where the level was used up.
 */

import { chosenOptions, profileOf } from '$lib/core/warband';
import { injuryBonus } from './wyrdcry-injuries';
import type { Advance, AdvanceEffects, Advancement, Faction, Fighter, FighterInstance, LevelOffer, LevelRule, OpenLevel, Rule } from '$lib/core/types';

import talents from '$lib/rules/wyrdcry/heroic-talents.json';
import limits from '$lib/rules/wyrdcry/racial-limits.json';

type Talent = (typeof talents)[number];

/**
 * The characteristics renown can raise, and how far one increase moves each.
 * Armour is not among them: it comes from what a fighter wears, and the racial
 * limits have no column for it. Health rises in twos; Bravery is a roll to beat,
 * so better is a lower number.
 */
const STEP: Record<string, number> = { move: 1, fight: 1, shoot: 1, health: 2, bravery: -1 };
const LABEL: Record<string, string> = { move: 'Move', fight: 'Fight', shoot: 'Shoot', health: 'Health', bravery: 'Bravery' };

/** Move in inches, Bravery a roll to beat, as the card writes them. */
function figure(stat: string, value: number): string {
	if (stat === 'move') return `${value}"`;
	if (stat === 'bravery') return `${value}+`;
	return String(value);
}

/** The most heroic talents a fighter can have, and the specializations they may come from. */
const MAX_TALENTS = 5;
const MAX_SPECIALIZATIONS = 2;

type Branch = 'henchman' | 'promotion' | 'hero' | 'none';

const NOTES: Record<Branch, string> = {
	henchman: 'A henchman raises a characteristic, and never the same one twice.',
	promotion:
		'This level promotes the henchman to HERO – the card shows it already. A hero raises a characteristic or picks a Heroic Talent.',
	hero: 'A hero raises a characteristic or picks a Heroic Talent.',
	none: 'This fighter has neither the HERO nor the HENCHMAN keyword, so the rules do not say what its renown is worth. A characteristic can be raised.'
};

/** The keywords the fighter was recruited with: its type's and its pick's. */
function recruited(instance: FighterInstance, fighter: Fighter): string[] {
	return [...fighter.keywords, ...chosenOptions(instance, fighter).flatMap((o) => o.keywords ?? [])];
}

/**
 * The rule a level falls under, read off the keywords the fighter was recruited
 * with. A henchman's fourth level is its promotion; from the fifth it is a hero.
 */
function branchOf(keywords: string[], level: number): Branch {
	if (keywords.includes('hero')) return 'hero';
	if (keywords.includes('henchman')) return level < 4 ? 'henchman' : level === 4 ? 'promotion' : 'hero';
	return 'none';
}

const renownOf = (instance: FighterInstance) => instance.tally?.renown ?? 0;

/**
 * A henchman with four levels of renown is a HERO, from the moment it has them
 * rather than from the moment the level is spent – worked out every time, as the
 * deck's card does. A fighter with neither keyword stays as it is.
 */
function keywords(instance: FighterInstance, held: string[]): string[] {
	if (renownOf(instance) < 4 || held.includes('hero') || !held.includes('henchman')) return held;
	return held.map((k) => (k === 'henchman' ? 'hero' : k));
}

function open(instance: FighterInstance, fighter: Fighter): OpenLevel[] {
	const spent = new Set((instance.advances ?? []).map((a) => a.level));
	const base = recruited(instance, fighter);
	const levels: OpenLevel[] = [];
	for (let level = 1; level <= renownOf(instance); level++) {
		if (!spent.has(level)) levels.push({ level, note: NOTES[branchOf(base, level)] });
	}
	return levels;
}

/** The limit of the first of the fighter's keywords that names a race with one. */
function limitFor(held: string[]): Record<string, number> | null {
	for (const keyword of held) {
		const limit = limits.find((l) => l.id === keyword);
		if (limit?.profile) return limit.profile as Record<string, number>;
	}
	return null;
}

const talentOf = (id: string) => talents.find((t) => t.id === id);

/** The weapons of a kind a talent can be taken for: what the fighter carries first, then what its faction sells. */
function weaponsFor(kind: string, instance: FighterInstance, fighter: Fighter, faction: Faction) {
	const carried = [...fighter.gear, ...chosenOptions(instance, fighter).flatMap((o) => o.gear ?? []), ...instance.wargear];
	const seen = new Set<string>();
	return [...carried, ...faction.wargear.map((w) => w.id)].flatMap((id) => {
		const piece = faction.wargear.find((w) => w.id === id);
		if (!piece || piece.kind !== kind || seen.has(id)) return [];
		seen.add(id);
		return [{ id, name: piece.name }];
	});
}

function offer(instance: FighterInstance, fighter: Fighter, faction: Faction, level: OpenLevel): LevelOffer {
	const base = recruited(instance, fighter);
	const branch = branchOf(base, level.level);
	const advances = instance.advances ?? [];
	const profile = profileOf(instance, fighter);
	const limit = limitFor(base);
	/* A henchman never raises the same characteristic twice, at its henchman levels only – a promotion starts clean. */
	const taken = new Set(advances.filter((a) => a.stat && a.level > 0 && branchOf(base, a.level) === 'henchman').map((a) => a.stat));

	const stats = Object.keys(STEP).flatMap((stat) => {
		const start = profile[stat];
		if (typeof start !== 'number') return [];
		/* From the figure as the fighter's levels and injuries left it: the reach of the limit is the result's, not the start's. */
		const from = advances.filter((a) => a.stat === stat).reduce((sum, a) => sum + (a.bonus ?? 0), start + injuryBonus(instance, stat));
		const bonus = STEP[stat];
		const to = from + bonus;
		const cap = limit?.[stat];
		const beyond = cap !== undefined && (stat === 'bravery' ? to < cap : to > cap);
		const repeat = branch === 'henchman' && taken.has(stat);
		return [
			{
				stat,
				label: LABEL[stat],
				from: figure(stat, from),
				to: figure(stat, to),
				bonus,
				blocked: beyond ? 'At its racial limit' : repeat ? 'Already raised by a henchman level' : null
			}
		];
	});

	if (branch !== 'hero' && branch !== 'promotion') return { stats, rules: [], rulesLabel: 'Heroic Talents', rulesNote: null };

	const held = advances.flatMap((a) => (a.rule && talentOf(a.rule) ? [talentOf(a.rule)!] : []));
	const specializations = new Set(held.map((t) => t.specialization));
	const talentRule = (talent: Talent): LevelRule => ({
		id: talent.id,
		name: talent.name,
		text: talent.text,
		type: talent.type,
		blocked: held.some((t) => t.id === talent.id)
			? 'Already taken'
			: held.length >= MAX_TALENTS
				? `Already ${MAX_TALENTS} talents`
				: !specializations.has(talent.specialization) && specializations.size >= MAX_SPECIALIZATIONS
					? `Already ${MAX_SPECIALIZATIONS} specializations`
					: null,
		weapons: 'weapon' in talent && talent.weapon ? weaponsFor(talent.weapon, instance, fighter, faction) : null
	});
	const groups = [...new Set(talents.map((t) => t.specialization))].map((specialization) => ({
		heading: specialization[0].toUpperCase() + specialization.slice(1),
		options: talents.filter((t) => t.specialization === specialization).map(talentRule)
	}));

	/* A wizard may learn one more of the abilities it was offered at recruitment in place of a talent. */
	const choice = fighter.choice;
	const learned = advances.filter((a) => a.rule && choice?.options.some((o) => o.id === a.rule)).length;
	const abilities = choice?.later
		? choice.options
				.filter((o) => !(instance.picks ?? []).includes(o.id) && !advances.some((a) => a.rule === o.id))
				.map((o): LevelRule => ({
					id: o.id,
					name: o.name,
					text: o.text,
					type: o.type,
					blocked: learned >= (choice.later ?? 0) ? 'Already learned another' : null,
					weapons: null
				}))
		: [];

	return {
		stats,
		rules: [...(abilities.length ? [{ heading: 'Magical abilities', options: abilities }] : []), ...groups],
		rulesLabel: 'Heroic Talents',
		rulesNote: `Up to ${MAX_TALENTS} talents, from at most ${MAX_SPECIALIZATIONS} specializations.`
	};
}

/**
 * The talents and abilities the fighter's levels brought, as rules of its own,
 * with what they add: a keyword, or a point of critical damage on the weapon a
 * talent was taken for.
 */
function effects(instance: FighterInstance, fighter: Fighter, faction: Faction): AdvanceEffects {
	const result: AdvanceEffects = { rules: [], keywords: [], weapons: [] };
	for (const advance of instance.advances ?? []) {
		if (!advance.rule) continue;
		const talent = talentOf(advance.rule);
		if (talent) {
			const weapon = advance.option ? faction.wargear.find((w) => w.id === advance.option) : undefined;
			result.rules.push({ name: weapon ? `${talent.name} (${weapon.name})` : talent.name, text: talent.text, type: talent.type });
			for (const effect of (talent.effects ?? []) as { kind: string; keyword?: string; bonus?: number }[]) {
				if (effect.kind === 'keyword' && effect.keyword) result.keywords.push(effect.keyword);
				const damage = weapon?.profile?.damage;
				if (effect.kind === 'crit' && weapon && damage) {
					const [hit, crit] = damage.split('/');
					result.weapons.push({ wargear: weapon.id, stat: 'damage', value: `${hit}/${Number(crit) + (effect.bonus ?? 0)}`, source: talent.name });
				}
			}
			continue;
		}
		const ability = fighter.choice?.options.find((o) => o.id === advance.rule);
		if (ability) result.rules.push({ name: ability.name, text: ability.text, type: ability.type } satisfies Rule);
	}
	return result;
}

/** A characteristic from the figure the advances before it left to the one it made, a rule by name. */
function describe(instance: FighterInstance, fighter: Fighter, faction: Faction, index: number): string {
	const advances = instance.advances ?? [];
	const advance = advances[index];
	if (!advance) return '';
	if (advance.stat) {
		const start = profileOf(instance, fighter)[advance.stat];
		if (typeof start !== 'number') return LABEL[advance.stat] ?? advance.stat;
		const from = advances.slice(0, index).filter((a) => a.stat === advance.stat).reduce((sum, a) => sum + (a.bonus ?? 0), start);
		const to = from + (advance.bonus ?? 0);
		return `${LABEL[advance.stat] ?? advance.stat} ${figure(advance.stat, from)} → ${figure(advance.stat, to)}`;
	}
	if (advance.rule) {
		const name = talentOf(advance.rule)?.name ?? fighter.choice?.options.find((o) => o.id === advance.rule)?.name ?? advance.rule;
		const weapon = advance.option ? faction.wargear.find((w) => w.id === advance.option) : undefined;
		return weapon ? `${name} (${weapon.name})` : name;
	}
	return 'used up';
}

export const advancement: Advancement = { label: 'Renown', counter: 'renown', open, offer, keywords, effects, describe };

/** Levels a file brings without a record of what they were spent on, written as used up so none stands open. */
export function usedUp(instance: FighterInstance): Advance[] {
	const spent = new Set((instance.advances ?? []).map((a) => a.level));
	const levels: Advance[] = [];
	for (let level = 1; level <= renownOf(instance); level++) if (!spent.has(level)) levels.push({ level });
	return levels;
}
