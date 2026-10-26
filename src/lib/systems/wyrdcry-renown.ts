/**
 * Spending Wyrdcry's renown as the Campaign Book 1.0 has it (pp. 11–15): which
 * levels a fighter has open, what each may raise or teach, and what a spent
 * level does to the card. A level asks for one or two parts – a characteristic,
 * and on some levels a heroic talent as well – and each part spent is an
 * `advance` on the fighter: a characteristic with its bonus, a heroic talent or
 * a magical ability by id, with the weapon a talent was taken for, or neither
 * where the level was used up, which settles the whole level.
 */

import { activeEffects } from '$lib/core/effects';
import { chosenOptions, profileOf } from '$lib/core/warband';
import { racialLimits as limits } from './wyrdcry-homebrew';
import { injuryBonus } from './wyrdcry-injuries';
import type { Advance, AdvanceEffects, Advancement, Faction, Fighter, FighterInstance, Issue, LevelOffer, LevelRule, OpenLevel, Rule, Warband } from '$lib/core/types';

import talents from '$lib/rules/wyrdcry/heroic-talents.json';

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

/** The most heroic talents a fighter can have, and the talent groups they may come from. */
const MAX_TALENTS = 5;
const MAX_SPECIALIZATIONS = 2;
/** The level from which a legendary ability can be picked. */
const LEGENDARY_FROM = 5;
/** The level that promotes a henchman to HERO. */
const PROMOTION = 3;

type Branch = 'start' | 'henchman' | 'promotion' | 'hero' | 'none';
type Part = 'stat' | 'rule';

/**
 * What the rules ask of a level: a characteristic always, a talent on a hero's
 * odd levels and at the promotion – but the level the leader arrives with buys
 * a talent only (p. 7).
 */
function partsOf(branch: Branch, level: number): Part[] {
	if (branch === 'start') return ['rule'];
	if (branch === 'promotion' || (branch === 'hero' && level % 2 === 1)) return ['stat', 'rule'];
	return ['stat'];
}

/** What the sheet says above the choice, by what the level still asks for. */
function noteFor(branch: Branch, level: number, needs: Part[]): string {
	if (branch === 'none') return 'This fighter has neither the HERO nor the HENCHMAN keyword, so the rules do not say what its renown is worth. A characteristic can be raised.';
	if (branch === 'henchman') return 'A henchman raises a characteristic, and never the same one twice.';
	if (branch === 'start') return 'The leader arrives with a level of renown, and picks a Heroic Talent with it.';
	const both = partsOf(branch, level).length === 2;
	const lead = branch === 'promotion' ? 'This level promotes the henchman to HERO – the card shows it already. ' : '';
	if (!both) return `${lead}A hero raises a characteristic on every level, and picks a Heroic Talent on every odd one.`;
	if (needs.length === 2) return `${lead}This level raises a characteristic and picks a Heroic Talent – one now, the other next.`;
	return needs[0] === 'stat' ? `${lead}The Heroic Talent is picked – now the characteristic.` : `${lead}The characteristic is raised – now the Heroic Talent.`;
}

/** The keywords the fighter was recruited with: its type's and its pick's. */
function recruited(instance: FighterInstance, fighter: Fighter): string[] {
	return [...fighter.keywords, ...chosenOptions(instance, fighter).flatMap((o) => o.keywords ?? [])];
}

/**
 * The rule a level falls under, read off the keywords the fighter was recruited
 * with. A leader's first level is the one it was recruited with; a henchman's
 * third level is its promotion, from the fourth it is a hero.
 */
function branchOf(keywords: string[], level: number): Branch {
	if (keywords.includes('leader') && level === 1) return 'start';
	if (keywords.includes('hero')) return 'hero';
	if (keywords.includes('henchman')) return level < PROMOTION ? 'henchman' : level === PROMOTION ? 'promotion' : 'hero';
	return 'none';
}

const renownOf = (instance: FighterInstance) => instance.tally?.renown ?? 0;

/**
 * A henchman with three levels of renown is a HERO, from the moment it has them
 * rather than from the moment the level is spent – worked out every time, as the
 * deck's card does. A fighter with neither keyword stays as it is.
 */
function keywords(instance: FighterInstance, held: string[]): string[] {
	if (renownOf(instance) < PROMOTION || held.includes('hero') || !held.includes('henchman')) return held;
	return held.map((k) => (k === 'henchman' ? 'hero' : k));
}

/**
 * Whether an advance still holds as a rule taken: a heroic talent the rules
 * still have – a legendary one only from its level on – or a magical ability the
 * fighter was offered. A talent the rules no longer have counts as never taken.
 */
function ruleHolds(advance: Advance, fighter: Fighter): boolean {
	if (!advance.rule) return false;
	const talent = talentOf(advance.rule);
	if (talent) return !talent.legendary || advance.level >= LEGENDARY_FROM;
	return !!fighter.choice?.options.some((o) => o.id === advance.rule);
}

/**
 * What a level still asks for, read off the advances spent on it as the rules
 * stand now: a level spent under older rules opens again for the part it lacks.
 * A level used up asks for nothing more.
 */
function needsOf(instance: FighterInstance, fighter: Fighter, level: number): Part[] {
	const spent = (instance.advances ?? []).filter((a) => a.level === level);
	if (spent.some((a) => !a.stat && !a.rule)) return [];
	return partsOf(branchOf(recruited(instance, fighter), level), level).filter((part) =>
		part === 'stat' ? !spent.some((a) => a.stat) : !spent.some((a) => ruleHolds(a, fighter))
	);
}

function open(instance: FighterInstance, fighter: Fighter): OpenLevel[] {
	const base = recruited(instance, fighter);
	const levels: OpenLevel[] = [];
	for (let level = 1; level <= renownOf(instance); level++) {
		const needs = needsOf(instance, fighter, level);
		if (needs.length) levels.push({ level, note: noteFor(branchOf(base, level), level, needs) });
	}
	return levels;
}

/** Who in the warband holds each legendary ability, by its id. */
function legendaryHolders(warband: Warband, faction: Faction): Map<string, FighterInstance[]> {
	const holders = new Map<string, FighterInstance[]>();
	for (const instance of warband.fighters) {
		const fighter = faction.fighters.find((f) => f.id === instance.fighterId);
		if (!fighter) continue;
		for (const advance of instance.advances ?? []) {
			if (!advance.rule || !talentOf(advance.rule)?.legendary || !ruleHolds(advance, fighter)) continue;
			holders.set(advance.rule, [...(holders.get(advance.rule) ?? []), instance]);
		}
	}
	return holders;
}

/** A legendary ability is unique: no two fighters of a warband have the same one (p. 12). */
function check(warband: Warband, faction: Faction): Issue[] {
	return [...legendaryHolders(warband, faction)].flatMap(([id, held]) => {
		if (held.length < 2) return [];
		const name = talentOf(id)?.name ?? id;
		const who = held.map((f) => f.name.trim() || 'Unnamed fighter').join(', ');
		return [{ code: 'legendary', kind: 'excess', message: `${name} is held by ${held.length} fighters (${who}); one fighter per warband may have it.`, short: 'One per warband' } satisfies Issue];
	});
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

/** The kind of weapon a talent is taken for, such as Weapon Master's melee, or null where it is taken for none. */
const weaponKind = (talent: Talent): string | null => ('weapon' in talent && talent.weapon) || null;

/**
 * The weapons of a kind a talent can be taken for: what the fighter carries
 * first, then what its faction sells – offered to or carried by one of its
 * fighters, so not a piece only found, such as a magic item or a sword from
 * the loot of a faction that sells none.
 */
function weaponsFor(kind: string, instance: FighterInstance, fighter: Fighter, faction: Faction) {
	const carried = [...fighter.gear, ...chosenOptions(instance, fighter).flatMap((o) => o.gear ?? []), ...instance.wargear];
	const seen = new Set<string>();
	const offered = new Set(faction.fighters.flatMap((f) => [...f.wargear, ...f.gear, ...(f.choice?.options ?? []).flatMap((o) => o.gear ?? [])]));
	const sold = faction.wargear.filter((w) => !w.foundOnly && offered.has(w.id)).map((w) => w.id);
	return [...carried, ...sold].flatMap((id) => {
		const piece = faction.wargear.find((w) => w.id === id);
		if (!piece || piece.kind !== kind || seen.has(id)) return [];
		seen.add(id);
		return [{ id, name: piece.name }];
	});
}

function offer(instance: FighterInstance, fighter: Fighter, faction: Faction, level: OpenLevel, warband: Warband): LevelOffer {
	const base = recruited(instance, fighter);
	const branch = branchOf(base, level.level);
	const needs = needsOf(instance, fighter, level.level);
	const advances = instance.advances ?? [];
	const profile = profileOf(instance, fighter, activeEffects(warband, faction));
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

	const offered = needs.includes('stat') ? stats : [];
	if (!needs.includes('rule')) return { stats: offered, rules: [], rulesLabel: 'Heroic Talents', rulesNote: null };

	const held = advances.flatMap((a) => (a.rule && talentOf(a.rule) && ruleHolds(a, fighter) ? [talentOf(a.rule)!] : []));
	const holders = legendaryHolders(warband, faction);
	const specializations = new Set(held.map((t) => t.specialization));
	/* Why a talent cannot be taken on this level, the first reason that holds; null where it can. */
	const blockedFor = (talent: Talent): string | null => {
		if (held.some((t) => t.id === talent.id)) return 'Already taken';
		if (talent.legendary && level.level < LEGENDARY_FROM) return `From renown ${LEGENDARY_FROM}`;
		if (talent.legendary && holders.get(talent.id)?.some((f) => f.instanceId !== instance.instanceId)) return 'Another fighter of the warband has it';
		if (held.length >= MAX_TALENTS) return `Already ${MAX_TALENTS} talents`;
		if (!specializations.has(talent.specialization) && specializations.size >= MAX_SPECIALIZATIONS) return `Already ${MAX_SPECIALIZATIONS} talent groups`;
		return null;
	};
	const talentRule = (talent: Talent): LevelRule => {
		const kind = weaponKind(talent);
		return {
			id: talent.id,
			name: talent.name,
			text: talent.text,
			type: talent.type,
			blocked: blockedFor(talent),
			weapons: kind ? weaponsFor(kind, instance, fighter, faction) : null
		};
	};
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
		stats: offered,
		rules: [...(abilities.length ? [{ heading: 'Magical abilities', options: abilities }] : []), ...groups],
		rulesLabel: 'Heroic Talents',
		rulesNote: `Up to ${MAX_TALENTS} talents, from at most ${MAX_SPECIALIZATIONS} talent groups. A legendary ability from renown ${LEGENDARY_FROM}, one fighter per warband.`
	};
}

/**
 * The talents and abilities the fighter's levels brought, as rules of its own,
 * with what they add: a keyword, a characteristic, or a point of critical damage
 * on the weapon a talent was taken for. A talent that no longer holds adds nothing.
 */
function effects(instance: FighterInstance, fighter: Fighter, faction: Faction): AdvanceEffects {
	const result: AdvanceEffects = { rules: [], keywords: [], weapons: [], stats: [] };
	for (const advance of instance.advances ?? []) {
		if (!advance.rule || !ruleHolds(advance, fighter)) continue;
		const talent = talentOf(advance.rule);
		if (talent) {
			/* Only a talent that is taken for a weapon names it: one that no longer is, such as Surgical Precision, keeps a weapon picked earlier off the card. */
			const weapon = advance.option && weaponKind(talent) ? faction.wargear.find((w) => w.id === advance.option) : undefined;
			result.rules.push({ name: weapon ? `${talent.name} (${weapon.name})` : talent.name, text: talent.text, type: talent.type });
			for (const effect of (talent.effects ?? []) as { kind: string; keyword?: string; characteristic?: string; bonus?: number }[]) {
				if (effect.kind === 'keyword' && effect.keyword) result.keywords.push(effect.keyword);
				if (effect.kind === 'stat' && effect.characteristic) result.stats.push({ stat: effect.characteristic, bonus: effect.bonus ?? 0, source: talent.name });
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
function describe(instance: FighterInstance, fighter: Fighter, faction: Faction, index: number, warband: Warband): string {
	const advances = instance.advances ?? [];
	const advance = advances[index];
	if (!advance) return '';
	if (advance.stat) {
		const start = profileOf(instance, fighter, activeEffects(warband, faction))[advance.stat];
		if (typeof start !== 'number') return LABEL[advance.stat] ?? advance.stat;
		const from = advances.slice(0, index).filter((a) => a.stat === advance.stat).reduce((sum, a) => sum + (a.bonus ?? 0), start);
		const to = from + (advance.bonus ?? 0);
		return `${LABEL[advance.stat] ?? advance.stat} ${figure(advance.stat, from)} → ${figure(advance.stat, to)}`;
	}
	if (advance.rule) {
		const talent = talentOf(advance.rule);
		/* A talent the rules no longer have is named from its id: `shield-wall` reads Shield Wall. */
		const name =
			talent?.name ??
			fighter.choice?.options.find((o) => o.id === advance.rule)?.name ??
			advance.rule.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
		const weapon = advance.option && (!talent || weaponKind(talent)) ? faction.wargear.find((w) => w.id === advance.option) : undefined;
		const named = weapon ? `${name} (${weapon.name})` : name;
		if (ruleHolds(advance, fighter)) return named;
		return talent ? `${named} – not before renown ${LEGENDARY_FROM}` : `${named} – no longer a heroic talent`;
	}
	return 'used up';
}

export const advancement: Advancement = { label: 'Renown', counter: 'renown', open, offer, keywords, effects, describe, check };

/** Levels a file brings without a record of what they were spent on, written as used up so none stands open. */
export function usedUp(instance: FighterInstance): Advance[] {
	const spent = new Set((instance.advances ?? []).map((a) => a.level));
	const levels: Advance[] = [];
	for (let level = 1; level <= renownOf(instance); level++) if (!spent.has(level)) levels.push({ level });
	return levels;
}
