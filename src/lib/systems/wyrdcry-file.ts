/**
 * A warband file out of the Wyrdcry Warband Deck or the Warband Builder, read
 * into this app's shape. The builder's model sits at the top of the file; the
 * deck adds what the builder has no field for under `_deck` – the picks, fluff,
 * battle history, colour and what each renown level was spent on.
 *
 * What this app has no place for is kept where it can be read, in the warband's
 * notes, or left out – and either way said, in the lines `hints` returns.
 */

import { readColour } from '$lib/colour';
import { activeEffects, recruitCost, type ActiveEffect } from '$lib/core/effects';
import { profileOf } from '$lib/core/warband';
import type { Advance, BattleRecord, Faction, Fighter, FighterInstance, Warband } from '$lib/core/types';
import { factions, game, wargearId } from './wyrdcry';
import { usedUp } from './wyrdcry-renown';

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const number = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Whether a parsed file is the deck's or the builder's: a warband at the top, gear under `equipment`. */
export function isDeckOrBuilder(parsed: Raw): boolean {
	return '_deck' in parsed || (Array.isArray(parsed.fighters) && parsed.fighters.some((f) => isObject(f) && 'equipment' in f));
}

export type DeckReadResult =
	| { ok: true; warband: Warband; hints: string[] }
	| { ok: false; message: string };

/**
 * A bare id as this app stores it, a piece the builder's game data names
 * differently by its `replaces`; one the game data does not know stays as it
 * is, and the card names it unknown.
 */
const gear = (ids: string[]) => ids.map((id) => wargearId(id) ?? id);

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function readDeckFile(parsed: Raw): DeckReadResult {
	const factionId = text(parsed.factionId);
	if (typeof parsed.id !== 'string' || !Array.isArray(parsed.fighters)) {
		return { ok: false, message: 'That file does not look like a warband.' };
	}
	if (!factionId) return { ok: false, message: 'This warband has no faction.' };
	const faction = factions.find((f) => f.id === factionId);
	if (!faction) {
		const name = factionId.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
		return { ok: false, message: `${name} is not in the app yet.` };
	}

	const meta = isObject(parsed._deck) ? parsed._deck : null;
	const selections = meta && isObject(meta.selections) ? meta.selections : null;
	const fighterPicks = selections && isObject(selections.fighters) ? selections.fighters : {};
	const modifiers = selections && Array.isArray(selections.modifiers) ? selections.modifiers.filter(isObject) : [];
	const picks = Object.fromEntries(
		faction.choices.map((c) => [c.id, selections && isObject(selections.rules) ? strings(selections.rules[c.id]) : []])
	);
	const effects = activeEffects({ picks }, faction);
	const renownHistory = meta && Array.isArray(meta.renownHistory) ? meta.renownHistory.filter(isObject) : [];
	const fluff = meta && isObject(meta.fluff) ? meta.fluff : null;
	const fighterFluff = fluff && isObject(fluff.fighters) ? fluff.fighters : {};

	let pending = 0;
	let usedLevels = 0;
	/* Fighters the file gives experience, which the Campaign Book no longer counts. */
	let experienced = 0;
	let overridden = 0;
	const unexplained: string[] = [];

	const fighters = parsed.fighters.filter(isObject).map((raw): FighterInstance => {
		const instanceId = text(raw.instanceId);
		const name = text(raw.customName);
		if (raw.isPending === true) pending += 1;
		const pendingGear = strings(raw.pendingEquipment);
		pending += pendingGear.length;
		/* The deck writes a price the picks cut, Desperate's Youngblood, as an override; the app cuts it alike. */
		const type = faction.fighters.find((f) => f.id === text(raw.fighterId));
		const override = number(raw.costOverride);
		if (override !== undefined && !(type && override === recruitCost(type, effects))) overridden += 1;

		const instance: FighterInstance = {
			instanceId,
			fighterId: text(raw.fighterId),
			name,
			wargear: gear([...strings(raw.equipment), ...pendingGear]),
			picks: strings(fighterPicks[instanceId])
		};
		const own = text(fighterFluff[instanceId]).trim();
		if (own) instance.fluff = own;
		const notes = text(raw.notes).trim();
		if (notes) instance.notes = notes;
		if (number(raw.xp)) experienced += 1;
		const renown = number(raw.renown);
		if (renown) instance.tally = { renown };

		const advances = advancesOf(instance, raw, type, effects, renownHistory, modifiers, selections !== null);
		if (advances.length) instance.advances = advances;
		/* A level the file holds no record of was spent elsewhere, or is lost with the deck's open ones: either way not open here. */
		const unrecorded = usedUp(instance);
		if (unrecorded.length) {
			instance.advances = [...advances, ...unrecorded];
			usedLevels += unrecorded.length;
		}
		for (const a of advances) {
			if (a.level === 0 && a.stat) unexplained.push(`${name || 'Unnamed fighter'} ${statLabel(a.stat)} ${signed(a.bonus ?? 0)}`);
		}
		return instance;
	});

	const custom = customLines(parsed, faction, fighters, selections !== null);
	const notes = [text(parsed.factionNotes).trim(), custom.length ? custom.join('\n') : ''].filter(Boolean).join('\n\n');

	const history = meta && Array.isArray(meta.history) ? meta.history.filter(isRecord) : [];
	const favour = number(parsed.favour);
	const gold = number(parsed.gold);
	const colour = meta && 'colour' in meta ? readColour(meta.colour) : null;
	const warbandFluff = text(fluff?.warband).trim();
	const exportedAt = meta ? text(meta.exportedAt) : '';

	const warband: Warband = {
		id: parsed.id as string,
		game: game.id,
		factionId,
		name: text(parsed.name),
		picks,
		fighters,
		...(colour ? { colour } : {}),
		...(warbandFluff ? { fluff: warbandFluff } : {}),
		...(notes ? { notes } : {}),
		...(gold !== undefined ? { gold } : {}),
		...(strings(parsed.stash).length ? { stash: gear(strings(parsed.stash)) } : {}),
		...(history.length ? { history } : {}),
		...(favour ? { tally: { favour } } : {}),
		...(exportedAt ? { updatedAt: exportedAt } : {})
	};

	const hints: string[] = [];
	if (pending) hints.push(`${pending} ${pending === 1 ? 'purchase' : 'purchases'} still pending in the builder ${pending === 1 ? 'is' : 'are'} taken as bought.`);
	if (custom.length) hints.push(`${custom.length} custom ${custom.length === 1 ? 'ability or weapon is' : 'abilities and weapons are'} added to the warband's notes.`);
	if (overridden) hints.push(`The builder's own price for ${overridden} ${overridden === 1 ? 'fighter' : 'fighters'} is left out; the app prices them itself.`);
	if (usedLevels) {
		hints.push(`${usedLevels} renown ${usedLevels === 1 ? 'level' : 'levels'} without a record of what ${usedLevels === 1 ? 'it was' : 'they were'} spent on ${usedLevels === 1 ? 'counts' : 'count'} as spent.`);
	}
	if (experienced) {
		hints.push(`Experience is not carried over – the Campaign Book counts renown only – for ${experienced} ${experienced === 1 ? 'fighter' : 'fighters'} that had some.`);
	}
	if (unexplained.length) hints.push(`Raised without a record of why, kept as such: ${unexplained.join(', ')}.`);
	const unknown = fighters.filter((f) => !faction.fighters.some((x) => x.id === f.fighterId));
	if (unknown.length) {
		hints.push(
			`Not among the faction's fighters here, and shown as unknown – a hired sword is hired for one battle here, from the Battle menu: ${unknown.map((f) => f.name || f.fighterId).join(', ')}.`
		);
	}

	return { ok: true, warband, hints };
}

function statLabel(key: string): string {
	return game.stats.find((s) => s.key === key)?.label ?? key;
}

function isRecord(v: unknown): v is BattleRecord {
	if (!isObject(v)) return false;
	return (
		typeof v.id === 'string' &&
		typeof v.date === 'string' &&
		/^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
		(v.result === 'win' || v.result === 'draw' || v.result === 'loss') &&
		typeof v.opponentWarband === 'string' &&
		typeof v.opponentPlayer === 'string'
	);
}

/**
 * What the fighter's levels were spent on. The deck records each one; what the
 * file's absolute figures raise beyond that – and beyond the fighter's own picks
 * and the wizard's modifiers – is kept as an advance of level 0, a raise without
 * a known reason, rather than dropped.
 */
function advancesOf(
	instance: FighterInstance,
	raw: Raw,
	fighter: Fighter | undefined,
	effects: ActiveEffect[],
	renownHistory: Raw[],
	modifiers: Raw[],
	fromWizard: boolean
): Advance[] {
	const advances: Advance[] = renownHistory
		.filter((e) => e.instanceId === instance.instanceId && number(e.level) !== undefined)
		.map((e) => ({
			level: e.level as number,
			...(typeof e.characteristic === 'string' ? { stat: e.characteristic, bonus: number(e.bonus) ?? 0 } : {}),
			...(typeof e.talent === 'string' ? { rule: e.talent } : {}),
			...(typeof e.choice === 'string' ? { option: gear([e.choice])[0] } : {})
		}));

	const overrides = isObject(raw.statOverrides) ? raw.statOverrides : {};
	if (!fighter) return advances;

	/* The wizard's modifiers stand for the picks and the faction's rules, which
	   this app works out from the picks itself; without them, the picks are all
	   the file can say. */
	const base = fromWizard ? fighter.profile : profileOf(instance, fighter, effects);
	for (const [key, value] of Object.entries(overrides)) {
		const figure = number(value);
		const start = base[key];
		if (figure === undefined || typeof start !== 'number') continue;
		const known =
			advances.filter((a) => a.stat === key).reduce((sum, a) => sum + (a.bonus ?? 0), 0) +
			(fromWizard
				? modifiers.filter((m) => m.instanceId === instance.instanceId && m.characteristic === key).reduce((sum, m) => sum + (number(m.bonus) ?? 0), 0)
				: 0);
		const rest = figure - start - known;
		if (rest) advances.push({ level: 0, stat: key, bonus: rest });
	}
	return advances;
}

/**
 * The builder's custom abilities and weapons as lines for the warband's notes.
 * What the deck's wizard wrote there and this app shows on the cards anyway is
 * left out: a faction rule carried by the faction's name, and a rolled mutation
 * the fighter's picks already hold.
 */
function customLines(parsed: Raw, faction: Faction, fighters: FighterInstance[], fromWizard: boolean): string[] {
	const ruleNames = new Set([...faction.rules.map((r) => r.name), ...faction.choices.flatMap((c) => c.options.map((o) => `${c.name} – ${o.name}`))]);
	const abilities = (Array.isArray(parsed.customAbilities) ? parsed.customAbilities : []).filter(isObject).flatMap((a) => {
		const carrier = text(a.fighter).trim();
		const ability = text(a.ability).trim();
		if (!ability) return [];
		const head = ability.replace(/^\[[^\]]+\]\s*/, '').split(':')[0].trim();
		if (carrier === faction.name && ruleNames.has(head)) return [];
		if (fromWizard && ability.includes('*Mutation*') && fighters.some((f) => f.name === carrier && f.picks?.length)) return [];
		return [`${carrier || faction.name}: ${ability}`];
	});
	const weapons = (Array.isArray(parsed.customWeapons) ? parsed.customWeapons : []).filter(isObject).map((w) => {
		const profile = [w.range, w.attacks, w.hit && w.crit ? `${w.hit}/${w.crit}` : '']
			.map((v) => text(v).trim() || String(number(v) ?? ''))
			.filter(Boolean)
			.join(' · ');
		const special = text(w.special).trim();
		return `Weapon: ${text(w.name).trim() || 'Unnamed'}${profile ? ` (${profile})` : ''}${special ? ` – ${special}` : ''}`;
	});
	return [...abilities, ...weapons];
}
