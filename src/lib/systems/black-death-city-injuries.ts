/**
 * Black Death City's injuries, step 2 of the aftermath (Playtest v1.10,
 * pp. 144–145): a fighter taken out of action rolls a D66 on the Injury
 * Table, a Beast, Skeleton, Thrall or Demon a D6 on its own table instead – the
 * first of them its keywords name, so a Rotling, Beast and Demon, rolls as a
 * Beast. An [Injury] is kept, temporary or permanent as rolled for it; a
 * second of the same is a Full Recovery. Black Rot is counted under `tally`
 * and kills at its fourth level; Beasts, Demons and the Undead are immune.
 */

import type { Faction, Fighter, FighterInstance, InjuryEffects, InjuryOutcome, InjuryResolution, InjuryResult, InjuryTable, Injuries } from '$lib/core/types';

import data from '$lib/rules/black-death-city/injuries.json';

interface RawResult {
	id: string;
	name: string;
	roll: string;
	type?: string;
	outcome?: string;
	text: string;
	/** The characteristic the injury halves, rounding up. */
	halve?: string;
	/** The characteristic the injury reduces by 1: a roll target, so its figure rises. */
	worsen?: string;
	/** Levels of Black Rot the result brings. */
	blackRot?: number;
	/** Bonus experience the result brings in step 3. */
	experience?: number;
}

interface RawTable {
	id: string;
	name: string;
	dice: string;
	/** The keywords that roll on it instead of the Injury Table; the Injury Table has none. */
	keywords?: string[];
	results: RawResult[];
}

const TABLES = data.tables as RawTable[];
const MAIN = TABLES.find((t) => !t.keywords)!;
const SMALL = TABLES.filter((t) => t.keywords);
const ALL = TABLES.flatMap((t) => t.results);

/** The counter Black Rot is kept in, and experience. */
export const BLACK_ROT = 'blackRot';
const EXPERIENCE = 'experience';

const FULL_RECOVERY = MAIN.results.find((r) => r.id === 'full-recovery')!;
const KILLED = MAIN.results.find((r) => r.id === 'killed')!;

function result(raw: RawResult): InjuryResult {
	return {
		id: raw.id,
		name: raw.name,
		roll: raw.roll,
		text: raw.text,
		...(raw.type ? { type: raw.type } : {}),
		...(raw.outcome ? { outcome: raw.outcome as InjuryOutcome } : {}),
		lasting: raw.type === 'injury'
	};
}

const tableFor = (fighter: Fighter) => SMALL.find((t) => t.keywords!.some((k) => fighter.keywords.includes(k))) ?? MAIN;

/** Whether the fighter shrugs off Black Rot: a Beast, a Demon or one of the Undead. */
export const immuneToBlackRot = (fighter: Fighter) => data.blackRot.immune.some((k) => fighter.keywords.includes(k));

/** The [Injury] results the fighter keeps. */
const held = (instance: FighterInstance) => (instance.injuries ?? []).flatMap((id) => ALL.filter((r) => r.id === id));

/**
 * A second of an [Injury] the fighter has is a Full Recovery; Black Rot leaves
 * an immune fighter as it was, and its fourth level kills.
 */
function resolve(instance: FighterInstance, fighter: Fighter, _faction: Faction, id: string): InjuryResolution {
	const rolled = tableFor(fighter).results.find((r) => r.id === id);
	if (!rolled) throw new Error(`No injury result "${id}" for this fighter`);
	if (rolled.type === 'injury' && held(instance).some((r) => r.id === rolled.id)) {
		return { result: result(FULL_RECOVERY), note: `Already has ${rolled.name}, which counts as a Full Recovery.` };
	}
	if (rolled.blackRot && immuneToBlackRot(fighter)) {
		return { result: result(FULL_RECOVERY), note: 'Beasts, Demons and the Undead are immune to Black Rot.' };
	}
	if (rolled.blackRot && (instance.tally?.[BLACK_ROT] ?? 0) + rolled.blackRot >= data.blackRot.kills) {
		return { result: result(KILLED), note: `That is its ${ordinal(data.blackRot.kills)} level of Black Rot: it succumbs to the plague and is killed.` };
	}
	return { result: result(rolled), note: null };
}

const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

/** The fighter with the result written in: an [Injury] it keeps, levels of Black Rot, bonus experience. */
function apply(instance: FighterInstance, fighter: Fighter, faction: Faction, id: string): FighterInstance {
	const { result: outcome } = resolve(instance, fighter, faction, id);
	if (outcome.lasting) return { ...instance, injuries: [...(instance.injuries ?? []), outcome.id] };
	const raw = ALL.find((r) => r.id === outcome.id)!;
	const tally = { ...instance.tally };
	if (raw.blackRot) tally[BLACK_ROT] = (tally[BLACK_ROT] ?? 0) + raw.blackRot;
	if (raw.experience) tally[EXPERIENCE] = (tally[EXPERIENCE] ?? 0) + raw.experience;
	return raw.blackRot || raw.experience ? { ...instance, tally } : instance;
}

/** The bonus experience a result brings, for the aftermath's experience page; 0 for most. */
export function injuryExperience(id: string | null): number {
	return (id && ALL.find((r) => r.id === id)?.experience) || 0;
}

/**
 * Each [Injury] kept as a rule of the fighter's, marked where it is temporary,
 * with what it does to a characteristic: half its figure, rounding up, or a
 * roll target 1 worse.
 */
function effects(instance: FighterInstance, fighter: Fighter): InjuryEffects {
	const found: InjuryEffects = { rules: [], keywords: [], weapons: [], stats: [], forbid: [] };
	for (const raw of held(instance)) {
		const temporary = instance.temporary?.includes(raw.id);
		found.rules.push({ name: temporary ? `${raw.name} (temporary)` : raw.name, text: raw.text, type: 'injury' });
		const figure = (stat: string) => fighter.profile[stat];
		if (raw.halve) {
			const value = figure(raw.halve);
			if (typeof value === 'number') found.stats.push({ stat: raw.halve, bonus: Math.ceil(value / 2) - value, source: raw.name });
		}
		if (raw.worsen && typeof figure(raw.worsen) === 'number') found.stats.push({ stat: raw.worsen, bonus: 1, source: raw.name });
	}
	return found;
}

function table(_instance: FighterInstance, fighter: Fighter): InjuryTable {
	const found = tableFor(fighter);
	return { table: found.name, dice: found.dice, results: found.results.map(result) };
}

export const injuries: Injuries = {
	table,
	exempt: () => null,
	resolve,
	apply,
	effects,
	result: (id) => {
		const raw = ALL.find((r) => r.id === id);
		return raw?.type === 'injury' ? result(raw) : null;
	},
	duration: data.temporary,
	recover: data.recover
};
