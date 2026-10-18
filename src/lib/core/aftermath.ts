/**
 * Ending a battle as the Wyrdcry Warband Deck does: the result and the shards,
 * then the injuries of who was taken out of action, then the roll each fighter
 * makes for a level, then the line in the battle history – answered in the aftermath's
 * sheet and written into the warband in one go. What each answer is worth is
 * the game's (`GameSystem.aftermath`, `GameSystem.injuries`); what an injury
 * does once – a death, a surgeon, a missed battle, a robbery, a capture – is
 * the same in every game and carried out here.
 */

import { stateOf, type BattleState } from './battle';
import { LEADER } from './effects';
import { today } from './history';
import { canLead, leaderOf } from './leader';
import { priceOf } from './stash';
import { purse, warbandCost } from './validate';
import { newId } from './warband';
import type { Aftermath, BattleRecord, Faction, Fighter, FighterInstance, GameSystem, InjuryResolution, Warband, Wargear } from './types';

/** Whether a surgeon was paid and what the roll said, for a result that needs one: none, and the fighter dies; else the roll. */
export type SurgeonAnswer = 'none' | 'died' | 'survived';

/** A fighter asked for its roll, with its answers as the battle left them. */
export interface AftermathRow {
	instanceId: string;
	name: string;
	/** Whether it took part in the battle; one that did not rolls nothing. */
	tookPart: boolean;
	/** The keywords its fighter carries, for a mark only some may take. */
	keywordIds: string[];
	/** By the key of each of the game's modifiers. */
	answers: Record<string, boolean>;
	/** The levels its roll – both rolls, when it is marked – came to, as tapped. */
	levels: number;
}

export interface AftermathDraft {
	rows: AftermathRow[];
	/**
	 * Who the battle left out of action, by instance id. The injury rolls and
	 * the modifier that asks after it both read this one list.
	 */
	out: string[];
	/** The result each of them rolled, by instance id: an id on the game's injury table. */
	injuries: Record<string, string>;
	/** For a fighter that dies, whether the roll for its equipment recovered it, by instance id. Missing reads as lost. */
	recovered: Record<string, boolean>;
	/** For a fighter whose result needs a surgeon, what came of it, by instance id. Missing changes nothing. */
	surgeon: Record<string, SurgeonAnswer>;
	/** The single-use pieces used up in the battle, by instance id: the place of each in the fighter's wargear. */
	used: Record<string, number[]>;
	/** What the roll a used piece asks for came to, by `usedKey`: true for the result that brings the injury. Missing is not yet rolled and changes nothing. */
	afterUse: Record<string, boolean>;
	/** Who never rolls, named under the rows. */
	excluded: string[];
	/** The fighters marked to roll twice, in the order they were marked. */
	marked: string[];
	/** Who takes the lead where the leader dies, by instance id; null while none is picked. */
	successor: string | null;
	result: BattleRecord['result'] | null;
	/** Wyrdstone shards delivered. */
	shards: number;
	/** Whether the battle goes into the history. */
	record: boolean;
	opponentWarband: string;
	opponentPlayer: string;
	/**
	 * A line already in the history from the day the battle started on, which
	 * is likely this battle entered by hand. Its presence starts `record` off.
	 */
	recorded: BattleRecord | null;
}

/** A fighter as the aftermath needs it: its name, and the keywords it carries, as the rules write them. */
export interface AftermathFighter {
	instanceId: string;
	name: string;
	keywordIds: string[];
	/** Whether an injury keeps it out of the battle, such as a capture: it is asked nothing and starts as not taking part. */
	away?: boolean;
}

/**
 * Who is asked, read once when the battle starts ending, each answer as the
 * game starts it. Whether a fighter fought at all is not something a battle's
 * state can prove, so a game starts that one as yes and the player takes out
 * who sat this one out.
 */
export function startAftermath(
	rules: Aftermath,
	fighters: AftermathFighter[],
	battle: BattleState | null,
	history: BattleRecord[] = []
): AftermathDraft {
	const earns = (f: AftermathFighter) => !f.keywordIds.some((k) => rules.excluded.includes(k));
	const since = today(battle ? new Date(battle.startedAt) : undefined);
	const recorded = history.filter((r) => r.date >= since).at(-1) ?? null;
	return {
		rows: fighters
			.filter((f) => earns(f) && !f.away)
			.map((f) => ({
				instanceId: f.instanceId,
				name: f.name,
				tookPart: true,
				keywordIds: f.keywordIds,
				answers: Object.fromEntries(
					rules.modifiers.map((q) => [q.key, q.start === 'not-out' ? !stateOf(battle, f.instanceId).out : q.start === 'yes'])
				),
				levels: 0
			})),
		excluded: fighters.filter((f) => !earns(f) && !f.away).map((f) => f.name),
		out: fighters.filter((f) => !f.away && stateOf(battle, f.instanceId).out).map((f) => f.instanceId),
		injuries: {},
		recovered: {},
		surgeon: {},
		used: {},
		afterUse: {},
		marked: [],
		successor: null,
		result: null,
		shards: 0,
		record: recorded === null,
		opponentWarband: '',
		opponentPlayer: '',
		recorded
	};
}

/**
 * Takes a fighter out of action or back, for the injuries and the roll alike:
 * the modifier that starts from the battle's state follows, and a fighter
 * brought back drops the result it was given.
 */
export function toggleOut(draft: AftermathDraft, rules: Aftermath, instanceId: string) {
	const out = !draft.out.includes(instanceId);
	draft.out = out ? [...draft.out, instanceId] : draft.out.filter((id) => id !== instanceId);
	if (!out) {
		delete draft.injuries[instanceId];
		delete draft.recovered[instanceId];
		delete draft.surgeon[instanceId];
	}
	const row = draft.rows.find((r) => r.instanceId === instanceId);
	for (const modifier of rules.modifiers) if (row && modifier.start === 'not-out') row.answers[modifier.key] = !out;
}

/** What the result a fighter was given comes to, as the game resolves it; null where it was given none or rolls none. */
export function injuryOf(draft: AftermathDraft, game: GameSystem, faction: Faction, instance: FighterInstance): InjuryResolution | null {
	const rolled = draft.out.includes(instance.instanceId) ? draft.injuries[instance.instanceId] : undefined;
	const type = faction.fighters.find((f) => f.id === instance.fighterId);
	if (!rolled || !type || !game.injuries?.table(instance, type, faction)) return null;
	return game.injuries.resolve(instance, type, faction, rolled);
}

/** Whether the result a fighter was given, as answered, kills it: dead on the table, or no surgeon, or a surgeon who failed. */
export function diesOf(draft: AftermathDraft, game: GameSystem, faction: Faction, instance: FighterInstance): boolean {
	const outcome = injuryOf(draft, game, faction, instance)?.result.outcome;
	const surgeon = outcome === 'surgeon' ? draft.surgeon[instance.instanceId] : undefined;
	return outcome === 'dead' || surgeon === 'none' || surgeon === 'died';
}

/** The key of one piece of a fighter's wargear, for the roll it asks for once used. */
export const usedKey = (instanceId: string, index: number) => `${instanceId}:${index}`;

/** The single-use pieces each fighter at the battle carries, with their place in its wargear; fighters without any are left out. */
export function singleUseOf(warband: Warband, faction: Faction): { instance: FighterInstance; pieces: { index: number; wargear: Wargear }[] }[] {
	return warband.fighters.flatMap((instance) => {
		if (instance.away) return [];
		const pieces = instance.wargear.flatMap((id, index) => {
			const wargear = faction.wargear.find((w) => w.id === id);
			return wargear?.singleUse ? [{ index, wargear }] : [];
		});
		return pieces.length ? [{ instance, pieces }] : [];
	});
}

/** Marks a piece as used up or takes it back, and with it what its roll came to. */
export function toggleUsed(draft: AftermathDraft, instanceId: string, index: number) {
	const used = draft.used[instanceId] ?? [];
	if (used.includes(index)) {
		draft.used[instanceId] = used.filter((i) => i !== index);
		delete draft.afterUse[usedKey(instanceId, index)];
	} else draft.used[instanceId] = [...used, index];
}

/** Whether a fighter that dies stays on the roster, marked dead: a leader, where the game has no one take its place. */
export const staysDead = (game: GameSystem, type: Fighter) => !game.succession && type.keywords.includes(LEADER);

/** The fighter leading the warband, where the answers have it die; null where it lives, or the game has no one take its place. */
export function fallenLeader(warband: Warband, game: GameSystem, faction: Faction, draft: AftermathDraft): FighterInstance | null {
	const leader = game.succession ? leaderOf(warband, faction) : null;
	return leader && diesOf(draft, game, faction, leader) ? leader : null;
}

/**
 * Who may take the lead from a fallen leader: a fighter that can lead and
 * lives through the injuries, with the keywords it has before the renown
 * roll – Death of a leader comes in the first step of the aftermath.
 */
export function heirsOf(warband: Warband, game: GameSystem, faction: Faction, draft: AftermathDraft): FighterInstance[] {
	const fallen = fallenLeader(warband, game, faction, draft);
	if (!fallen) return [];
	return warband.fighters.filter((f) => f !== fallen && canLead(f, faction, game) && !diesOf(draft, game, faction, f));
}

/** What a fighter's result costs as answered, such as a surgeon paid for; 0 where nothing is paid. */
function feeOf(draft: AftermathDraft, game: GameSystem, faction: Faction, instance: FighterInstance): number {
	const resolution = injuryOf(draft, game, faction, instance);
	const answer = draft.surgeon[instance.instanceId];
	return resolution?.result.outcome === 'surgeon' && (answer === 'died' || answer === 'survived') ? (resolution.result.cost ?? 0) : 0;
}

/**
 * The gold the warband has left before the battle's income – the purse less
 * what the warband is worth – less what the answers already spend for every
 * fighter but `instanceId`.
 */
export function goldLeft(warband: Warband, game: GameSystem, faction: Faction, draft: AftermathDraft, instanceId: string): number {
	const spent = warband.fighters.reduce((sum, f) => sum + (f.instanceId === instanceId ? 0 : feeOf(draft, game, faction, f)), 0);
	return purse(warband, game) - warbandCost(warband, faction) - spent;
}

/** The score a row's roll needs on the die: the game's target, less 1 for each modifier that holds. */
export function scoreNeeded(row: AftermathRow, rules: Aftermath): number {
	return rules.roll.target - Object.values(row.answers).filter(Boolean).length;
}

/** Who took part and was not taken out of action, by instance id. */
export function survivorsOf(draft: AftermathDraft): string[] {
	return draft.rows.filter((r) => r.tookPart && !draft.out.includes(r.instanceId)).map((r) => r.instanceId);
}

/** The marks the warband may give beyond the first, as the fighters that came through give them; none where the game has none. */
export function extraMarksOf(warband: Warband, rules: Aftermath, draft: AftermathDraft): { keyword: string; notes: string[] } {
	return rules.extraMarks?.(warband, survivorsOf(draft)) ?? { keyword: '', notes: [] };
}

/**
 * Why a row cannot be marked as well: no marks left, or the one mark open to
 * any fighter already taken by one without the keyword the further marks ask
 * for. Null where it can, or is marked already and can be unmarked.
 */
function markBlocked(row: AftermathRow, marks: string[], rows: AftermathRow[], extra: { keyword: string; notes: string[] }): string | null {
	if (marks.includes(row.instanceId)) return null;
	if (!row.tookPart) return 'Did not take part';
	const room = 1 + extra.notes.length;
	if (marks.length >= room) return room === 1 ? 'Another fighter is marked' : `Already ${room} marked`;
	const free = (id: string) => !rows.find((r) => r.instanceId === id)?.keywordIds.includes(extra.keyword);
	if (free(row.instanceId) && marks.some(free)) return `The second mark goes to a ${extra.keyword.toUpperCase()}`;
	return null;
}

/** The marks that stand, in the order given: one that no mark is left for any more, as a Drillmaster taken out of action leaves it, drops. */
export function marksOf(draft: AftermathDraft, extra: { keyword: string; notes: string[] }): string[] {
	return draft.marked.reduce<string[]>((kept, id) => {
		const row = draft.rows.find((r) => r.instanceId === id);
		return row && markBlocked(row, kept, draft.rows, extra) === null ? [...kept, id] : kept;
	}, []);
}

/** Why the row cannot be marked now, against the marks that stand. */
export function markReason(draft: AftermathDraft, row: AftermathRow, extra: { keyword: string; notes: string[] }): string | null {
	return markBlocked(row, marksOf(draft, extra), draft.rows, extra);
}

/** How many rolls a row makes: two for a marked fighter, one for the rest, none for one that did not take part. */
export function rollsOf(row: AftermathRow, marks: string[]): number {
	return row.tookPart ? (marks.includes(row.instanceId) ? 2 : 1) : 0;
}

/** The levels a row earns, as tapped, never more than its rolls. */
export function levelsEarned(row: AftermathRow, marks: string[]): number {
	return Math.min(row.levels, rollsOf(row, marks));
}

/** The battle's line in the history, or null where none is to be added. */
export function battleRecord(draft: AftermathDraft, at = new Date()): BattleRecord | null {
	if (!draft.record || !draft.result) return null;
	return {
		id: newId(),
		date: today(at),
		result: draft.result,
		opponentWarband: draft.opponentWarband.trim(),
		opponentPlayer: draft.opponentPlayer.trim()
	};
}

/**
 * The warband with the battle's injuries, levels, income and history line
 * written in. A fighter that missed this battle with an injury is back for the
 * next. The injury comes first, as the aftermath rolls it first: a level of
 * renown it brings is there before the roll's, and a fighter that dies
 * earns none. A dead fighter leaves the roster, its bought wargear going to the
 * stash where the roll recovered it – or, dying at the surgeon's, always; a
 * dead leader stays, marked dead, only where the game has no one take its
 * place, and elsewhere the fighter picked takes the lead. A surgeon's fee comes off the gold, robbery
 * takes what the fighter bought, and a capture or a missed battle marks it.
 * A single-use piece used up is struck before any of it, so a dead fighter
 * leaves none to the stash; a roll it asked for that brought an injury adds
 * that injury to a fighter that lives, unless it has it already.
 */
export function applyAftermath(warband: Warband, game: GameSystem, faction: Faction, draft: AftermathDraft, at = new Date()): Warband {
	const rules = game.aftermath;
	if (!rules) return warband;
	const earned = rules.income(warband, game, draft.result, draft.shards, survivorsOf(draft));
	const marks = marksOf(draft, extraMarksOf(warband, rules, draft));
	const record = battleRecord(draft, at);
	const heir = heirsOf(warband, game, faction, draft).find((f) => f.instanceId === draft.successor)?.instanceId ?? null;
	const rows = new Map(draft.rows.map((r) => [r.instanceId, r]));
	/* What leaves the warband's worth – a fighter, what it carried – leaves the
	   purse with it, so the gold left stays where it was; a fee comes off the
	   gold left. */
	let spent = 0;
	const stash = [...(warband.stash ?? [])];
	const fighters = warband.fighters.flatMap((before): FighterInstance[] => {
		const { away, ...back } = before;
		let fighter: FighterInstance = away === 'miss-next-battle' ? back : before;
		const id = fighter.instanceId;
		const used = draft.used[id] ?? [];
		if (used.length) {
			spent += used.reduce((sum, index) => sum + priceOf(fighter.wargear[index], faction), 0);
			fighter = { ...fighter, wargear: fighter.wargear.filter((_, index) => !used.includes(index)) };
		}
		const type = faction.fighters.find((f) => f.id === before.fighterId);
		const resolution = injuryOf(draft, game, faction, fighter);
		if (resolution && type && game.injuries) {
			fighter = game.injuries.apply(fighter, type, faction, draft.injuries[id]);
			const { outcome } = resolution.result;
			const surgeon = outcome === 'surgeon' ? draft.surgeon[id] : undefined;
			spent += feeOf(draft, game, faction, before);
			const dies = diesOf(draft, game, faction, before);
			const carried = fighter.wargear.reduce((sum, piece) => sum + priceOf(piece, faction), 0);
			if (dies && staysDead(game, type)) return [{ ...fighter, away: 'dead' }];
			if (dies) {
				const kept = surgeon === 'died' || draft.recovered[id];
				if (kept) stash.push(...fighter.wargear);
				spent += type.cost + (kept ? 0 : carried);
				return [];
			}
			if (outcome === 'robbed') {
				spent += carried;
				fighter = { ...fighter, wargear: [] };
			}
			if (outcome === 'captured' || outcome === 'miss-next-battle') fighter = { ...fighter, away: outcome };
		}
		for (const index of used) {
			const roll = rules.afterUse?.find((r) => r.wargear === before.wargear[index]);
			const held = fighter.injuries ?? [];
			if (roll && draft.afterUse[usedKey(id, index)] && !held.includes(roll.injury)) fighter = { ...fighter, injuries: [...held, roll.injury] };
		}
		if (id === heir) fighter = { ...fighter, leader: true };
		const row = rows.get(fighter.instanceId);
		const levels = row ? levelsEarned(row, marks) : 0;
		return [levels > 0 ? rules.gainLevels(fighter, levels) : fighter];
	});
	return {
		...warband,
		gold: earned.gold - spent,
		tally: earned.tally,
		...(stash.length || warband.stash ? { stash } : {}),
		...(record ? { history: [...(warband.history ?? []), record] } : {}),
		fighters
	};
}
