/**
 * Black Death City's advancement, step 3 of the aftermath (Playtest v1.10,
 * p. 146): each rank a fighter reaches beyond the one it was recruited at
 * brings an advancement roll, spent on the back of its card. The d6 is tapped
 * first, then only what it gives can be picked: Initiative or Willpower, Move,
 * Life, Blade or Bow, or – Fated – a skill, a signature spell or any of those.
 * Thralls and Beasts never gain ranks.
 */

import type { Advance, AdvanceEffects, Advancement, Faction, Fighter, FighterInstance, LevelOffer, LevelRule, OpenLevel, StatDef, Warband } from '$lib/core/types';

import ranks from '$lib/rules/black-death-city/ranks.json';

/** A skill table as the data writes it; `keywords` are those a Leader or Champion needs for it, none for any fighter. */
export interface SkillTable {
	id: string;
	name: string;
	keywords?: string[];
	skills: { id: string; name: string; text: string }[];
}

/** The rank a fighter's experience gives it, 1 to 20. */
export function rankOf(experience: number): number {
	return ranks.ranks.filter((from) => experience >= from).length;
}

/** The advancement roll's d6, as the table prints it. */
const ROLL: NonNullable<LevelOffer['roll']> = {
	label: 'Advancement roll · D6',
	results: [
		{ roll: '1', name: 'Wits', text: "Increase the fighter's Initiative value or Willpower value by 1.", stats: ['initiative', 'willpower'], rules: false },
		{ roll: '2', name: 'Speed', text: "Increase the fighter's Move value by 1.", stats: ['move'], rules: false },
		{ roll: '3–4', name: 'Constitution', text: "Increase the fighter's Life value by 1.", stats: ['life'], rules: false },
		{ roll: '5', name: 'Combat Prowess', text: "Increase the fighter's Blade value or Bow value by 1 (to a maximum of 2+).", stats: ['blade', 'bow'], rules: false },
		{
			roll: '6',
			name: 'Fated',
			text: 'Pick a skill for the fighter, a spell from a lore it knows as a signature spell if it is a Wizard or Priest, or 1 of the other results.',
			stats: ['initiative', 'willpower', 'move', 'life', 'blade', 'bow'],
			rules: true
		}
	]
};

/** Blade and Bow are roll targets: better is a lower figure, and 2+ the best. */
const TARGETS = ['blade', 'bow'];
const BEST = 2;

const NEVER = ['thrall', 'beast'];

interface Deps {
	/** The game's characteristics, read when a level is offered. */
	stats: () => StatDef[];
	/** The skill tables of the fighter's faction, the Veteran Skills first. */
	skills: (faction: Faction) => SkillTable[];
}

export function blackDeathCityAdvancement({ stats, skills }: Deps): Advancement {
	const spentLevels = (instance: FighterInstance) => new Set((instance.advances ?? []).filter((a) => a.level > 0).map((a) => a.level));

	function open(instance: FighterInstance, fighter: Fighter): OpenLevel[] {
		if (NEVER.some((k) => fighter.keywords.includes(k)) || instance.fromRank === undefined) return [];
		const now = rankOf(instance.tally?.experience ?? 0);
		const spent = spentLevels(instance);
		const levels: OpenLevel[] = [];
		for (let rank = instance.fromRank + 1; rank <= now; rank++) {
			if (!spent.has(rank)) levels.push({ level: rank, note: `Rank ${rank}: roll a dice on the Advancement table and tap the result, then pick what it gives.` });
		}
		return levels;
	}

	/** What the advances add to a characteristic, before the one at `before`. */
	const raised = (instance: FighterInstance, stat: string, before = Infinity) =>
		(instance.advances ?? []).slice(0, before).reduce((sum, a) => sum + (a.stat === stat ? (a.bonus ?? 0) : 0), 0);

	const figure = (fighter: Fighter, instance: FighterInstance, stat: string, before?: number) => {
		const base = fighter.profile[stat];
		return typeof base === 'number' ? base + raised(instance, stat, before) : null;
	};

	const written = (stat: string, value: number) => {
		const format = stats().find((s) => s.key === stat)?.format;
		return format === 'target' ? `${value}+` : format === 'inches' ? `${value}"` : String(value);
	};

	/** The rules the fighter holds already, picked when recruited or taken with an advance. */
	const held = (instance: FighterInstance) => new Set([...(instance.picks ?? []), ...(instance.advances ?? []).flatMap((a) => (a.rule ? [a.rule] : []))]);

	/** The skill tables the fighter may pick from: the Veteran Skills, and its faction's own where it is a Leader or Champion with their keywords. */
	function tablesFor(fighter: Fighter, faction: Faction): SkillTable[] {
		const leads = fighter.keywords.includes('leader') || fighter.keywords.includes('champion');
		return skills(faction).filter((t) => !t.keywords || (leads && t.keywords.every((k) => fighter.keywords.includes(k))));
	}

	/** The spells of the lores a Wizard or Priest knows, from the choices it picks its signature spells under. */
	const spellsFor = (fighter: Fighter) =>
		fighter.keywords.some((k) => k === 'wizard' || k === 'priest') ? (fighter.choices ?? []).filter((c) => c.noun?.one === 'signature spell') : [];

	function offer(instance: FighterInstance, fighter: Fighter, faction: Faction): LevelOffer {
		const has = held(instance);
		const rule = (id: string, name: string, text: string, type?: string): LevelRule => ({
			id,
			name,
			text,
			...(type ? { type } : {}),
			blocked: has.has(id) ? 'Already has it' : null,
			weapons: null
		});
		return {
			stats: ['initiative', 'willpower', 'move', 'life', 'blade', 'bow'].map((stat) => {
				const label = stats().find((s) => s.key === stat)?.label ?? stat;
				const now = figure(fighter, instance, stat);
				const target = TARGETS.includes(stat);
				const bonus = target ? -1 : 1;
				if (now === null) return { stat, label, from: '–', to: '–', bonus, blocked: `No ${label} value` };
				const blocked = target && now <= BEST ? `Already ${BEST}+` : null;
				return { stat, label, from: written(stat, now), to: written(stat, now + bonus), bonus, blocked };
			}),
			rules: [
				...tablesFor(fighter, faction).map((t) => ({ heading: t.name, options: t.skills.map((s) => rule(s.id, s.name, s.text)) })),
				...spellsFor(fighter).map((c) => ({ heading: 'Signature spells', options: c.options.map((o) => rule(o.id, o.name, o.text, o.type)) }))
			],
			rulesLabel: 'Skills and spells',
			rulesNote: null,
			roll: ROLL
		};
	}

	/** What a rule taken with an advance is, from the fighter's tables and lores. */
	function ruleOf(fighter: Fighter, faction: Faction, id: string) {
		for (const t of skills(faction)) {
			const skill = t.skills.find((s) => s.id === id);
			if (skill) return { name: skill.name, text: skill.text };
		}
		for (const c of fighter.choices ?? []) {
			const option = c.options.find((o) => o.id === id);
			if (option) return { name: option.name, text: option.text ?? '', ...(option.type ? { type: option.type } : {}) };
		}
		return null;
	}

	/** The skills and spells the advances took; the characteristics they raised the card counts from the advances itself. */
	function effects(instance: FighterInstance, fighter: Fighter, faction: Faction): AdvanceEffects {
		const rules = (instance.advances ?? []).flatMap((a) => (a.rule ? (ruleOf(fighter, faction, a.rule) ?? []) : []));
		return { rules, keywords: [], stats: [], weapons: [] };
	}

	function describe(instance: FighterInstance, fighter: Fighter, faction: Faction, index: number, _warband: Warband): string {
		const a: Advance | undefined = instance.advances?.[index];
		if (!a) return '';
		if (a.stat) {
			const before = figure(fighter, instance, a.stat, index);
			const label = stats().find((s) => s.key === a.stat)?.label ?? a.stat;
			return before === null ? label : `${label} ${written(a.stat, before)} → ${written(a.stat, before + (a.bonus ?? 0))}`;
		}
		if (a.rule) return ruleOf(fighter, faction, a.rule)?.name ?? a.rule;
		return 'used up';
	}

	return {
		label: 'Rank',
		spend: 'Advancement rolls',
		counter: 'experience',
		floor: (level) => ranks.ranks[level - 1] ?? 0,
		open,
		offer,
		keywords: (_instance, keywords) => keywords,
		effects,
		describe
	};
}
