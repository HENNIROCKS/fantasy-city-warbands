/**
 * Wyrdcry's injuries, step 1 of the aftermath: a HERO taken out of action rolls
 * on the Lasting Injury Table, any other fighter a D6, and a fighter with
 * Unbending Will not at all. The results a fighter keeps are stored by id under
 * `injuries`, and what they do to the card is worked out from there, as a
 * level's is from its advance.
 */

import { chosenOptions } from '$lib/core/warband';
import type { Faction, Fighter, FighterInstance, InjuryEffects, InjuryOutcome, InjuryResolution, InjuryResult, InjuryTable, Injuries } from '$lib/core/types';

import heroTable from '$lib/rules/wyrdcry/injuries-hero.json';
import henchmanTable from '$lib/rules/wyrdcry/injuries-henchman.json';

interface RawEffect {
	kind: string;
	characteristic?: string;
	bonus?: number;
	keyword?: string;
	ability_type?: string;
}

interface RawResult {
	id: string;
	name: string;
	roll: { min: number; max: number };
	type: string | null;
	outcome?: string;
	cost?: number;
	text: string;
	effects: RawEffect[];
}

const HERO = heroTable as RawResult[];
const HENCHMAN = henchmanTable as RawResult[];

/** A HERO dies of a fourth injury. */
const LIMIT = 3;
const UNBENDING_WILL = { id: 'unbending-will', name: 'Unbending Will' };
const FLESH_WOUND = 'flesh-wound';
const DEAD = 'dead';

/** Hardened carries no type in brackets, and stays with the fighter all the same. */
const KEPT_UNTYPED = ['hardened'];

const isLasting = (raw: RawResult) => raw.type !== null || KEPT_UNTYPED.includes(raw.id);
const isInjury = (raw: RawResult) => raw.type === 'injury';

function result(raw: RawResult): InjuryResult {
	const { min, max } = raw.roll;
	return {
		id: raw.id,
		name: raw.name,
		roll: min === max ? String(min) : `${min}–${max}`,
		text: raw.text,
		...(raw.type ? { type: raw.type } : {}),
		...(raw.outcome ? { outcome: raw.outcome as InjuryOutcome } : {}),
		...(raw.cost ? { cost: raw.cost } : {}),
		lasting: isLasting(raw)
	};
}

/** The results the fighter keeps, as the hero table writes them – only a HERO keeps any. */
function held(instance: FighterInstance): RawResult[] {
	return (instance.injuries ?? []).flatMap((id) => HERO.filter((r) => r.id === id));
}

/** What the fighter's injuries add to a characteristic, for the figure a level of renown starts from. */
export function injuryBonus(instance: FighterInstance, stat: string): number {
	return held(instance)
		.flatMap((r) => r.effects)
		.reduce((sum, e) => sum + (e.kind === 'stat' && e.characteristic === stat ? (e.bonus ?? 0) : 0), 0);
}

/** The fighter's injuries that roll before the shards are delivered, such as Sticky Fingers, by name. */
export function shardRolls(instance: FighterInstance): string[] {
	return held(instance).flatMap((r) => (r.effects.some((e) => e.kind === 'shard-roll') ? [r.name] : []));
}

interface Deps {
	/** The ability ids the fighter's type is recruited with, which the shared form names only as rules. */
	abilities: (faction: Faction, fighter: Fighter) => string[];
	/** The fighter's keywords as its levels make them, such as a henchman's promotion to HERO. */
	keywords: (instance: FighterInstance, keywords: string[]) => string[];
}

export function wyrdcryInjuries({ abilities, keywords }: Deps): Injuries {
	const isHero = (instance: FighterInstance, fighter: Fighter) =>
		keywords(instance, [...fighter.keywords, ...chosenOptions(instance, fighter).flatMap((o) => o.keywords ?? [])]).includes('hero');

	const exempt = (_instance: FighterInstance, fighter: Fighter, faction: Faction) =>
		abilities(faction, fighter).includes(UNBENDING_WILL.id) ? UNBENDING_WILL.name : null;

	function rows(instance: FighterInstance, fighter: Fighter, faction: Faction): RawResult[] | null {
		if (exempt(instance, fighter, faction)) return null;
		return isHero(instance, fighter) ? HERO : HENCHMAN;
	}

	function table(instance: FighterInstance, fighter: Fighter, faction: Faction): InjuryTable | null {
		const found = rows(instance, fighter, faction);
		if (!found) return null;
		return found === HERO
			? { table: 'Lasting Injury Table', dice: 'D66', results: HERO.map(result) }
			: { table: 'Injuries', dice: 'D6', results: HENCHMAN.map(result) };
	}

	/**
	 * An injury the fighter already has is a Flesh Wound instead; a fourth one
	 * kills it. Hardened, Hatred and Horrible Scars are kept once as well, so a
	 * second of them leaves the fighter as a Flesh Wound would. Only `[Injury]`
	 * results count towards the limit. Nine Lives re-rolls at the table, before
	 * the result is tapped.
	 */
	function resolve(instance: FighterInstance, fighter: Fighter, faction: Faction, id: string): InjuryResolution {
		const found = rows(instance, fighter, faction);
		const rolled = found?.find((r) => r.id === id);
		if (!found || !rolled) throw new Error(`No injury result "${id}" for this fighter`);
		const kept = held(instance);
		if (isLasting(rolled) && kept.some((r) => r.id === rolled.id)) {
			return { result: result(HERO.find((r) => r.id === FLESH_WOUND)!), note: `Already has ${rolled.name}, which counts as a Flesh Wound.` };
		}
		if (isInjury(rolled) && kept.filter(isInjury).length >= LIMIT) {
			return { result: result(HERO.find((r) => r.id === DEAD)!), note: `${rolled.name} would be a fourth injury, which kills a HERO.` };
		}
		return { result: result(rolled), note: null };
	}

	function apply(instance: FighterInstance, fighter: Fighter, faction: Faction, id: string): FighterInstance {
		const { result: outcome } = resolve(instance, fighter, faction, id);
		if (outcome.lasting) return { ...instance, injuries: [...(instance.injuries ?? []), outcome.id] };
		if (outcome.outcome === 'renown') {
			const tally = instance.tally ?? {};
			return { ...instance, tally: { ...tally, renown: (tally.renown ?? 0) + 1 } };
		}
		return instance;
	}

	/** Each result kept as a rule of the fighter's, with what it changes: a characteristic, a keyword, the reactions it may make. */
	function effects(instance: FighterInstance): InjuryEffects {
		const found: InjuryEffects = { rules: [], keywords: [], weapons: [], stats: [], forbid: [] };
		for (const raw of held(instance)) {
			found.rules.push({ name: raw.name, text: raw.text, ...(raw.type ? { type: raw.type } : {}) });
			for (const effect of raw.effects) {
				if (effect.kind === 'stat' && effect.characteristic) found.stats.push({ stat: effect.characteristic, bonus: effect.bonus ?? 0, source: raw.name });
				if (effect.kind === 'keyword' && effect.keyword) found.keywords.push(effect.keyword);
				if (effect.kind === 'forbid' && effect.ability_type) found.forbid.push({ type: effect.ability_type, source: raw.name });
			}
		}
		return found;
	}

	function kept(id: string): InjuryResult | null {
		const raw = HERO.find((r) => r.id === id);
		return raw && isLasting(raw) ? result(raw) : null;
	}

	return { table, exempt, resolve, apply, effects, result: kept };
}
