/**
 * Ending a battle as the Wyrdcry Warband Deck does: the result and the shards,
 * then the injuries of who was taken out of action, then who earned
 * experience, then the line in the battle history – answered
 * on the back of the warband card and written into the warband in one go. What
 * each answer is worth is the game's (`GameSystem.aftermath`).
 */

import { stateOf, type BattleState } from './battle';
import { today } from './history';
import { newId } from './warband';
import type { Aftermath, BattleRecord, Faction, GameSystem, Warband } from './types';

/** A fighter asked for its experience, with its answers as the battle left them. */
export interface AftermathRow {
	instanceId: string;
	name: string;
	/** By the key of each of the game's questions. */
	answers: Record<string, boolean>;
}

export interface AftermathDraft {
	rows: AftermathRow[];
	/**
	 * Who the battle left out of action, by instance id. The injury rolls and
	 * the experience question that asks after it both read this one list.
	 */
	out: string[];
	/** The result each of them rolled, by instance id: an id on the game's injury table. */
	injuries: Record<string, string>;
	/** Who never earns experience, named under the rows. */
	excluded: string[];
	/** The one fighter given the bonus point, if any. */
	bonus: string | null;
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
	const earns = (f: AftermathFighter) => !f.keywordIds.some((k) => rules.noXp.includes(k));
	const since = today(battle ? new Date(battle.startedAt) : undefined);
	const recorded = history.filter((r) => r.date >= since).at(-1) ?? null;
	return {
		rows: fighters.filter(earns).map((f) => ({
			instanceId: f.instanceId,
			name: f.name,
			answers: Object.fromEntries(
				rules.questions.map((q) => [q.key, q.start === 'not-out' ? !stateOf(battle, f.instanceId).out : q.start === 'yes'])
			)
		})),
		excluded: fighters.filter((f) => !earns(f)).map((f) => f.name),
		out: fighters.filter((f) => stateOf(battle, f.instanceId).out).map((f) => f.instanceId),
		injuries: {},
		bonus: null,
		result: null,
		shards: 0,
		record: recorded === null,
		opponentWarband: '',
		opponentPlayer: '',
		recorded
	};
}

/**
 * Takes a fighter out of action or back, for the injuries and the experience
 * alike: the question that starts from the battle's state follows, and a
 * fighter brought back drops the result it was given.
 */
export function toggleOut(draft: AftermathDraft, rules: Aftermath, instanceId: string) {
	const out = !draft.out.includes(instanceId);
	draft.out = out ? [...draft.out, instanceId] : draft.out.filter((id) => id !== instanceId);
	if (!out) delete draft.injuries[instanceId];
	const row = draft.rows.find((r) => r.instanceId === instanceId);
	for (const question of rules.questions) if (row && question.start === 'not-out') row.answers[question.key] = !out;
}

/** The points a row earns: one for each answer that holds, one more for the bonus. */
export function xpEarned(row: AftermathRow, bonus: string | null): number {
	return Object.values(row.answers).filter(Boolean).length + (bonus === row.instanceId ? 1 : 0);
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

/** The warband with the battle's injuries, experience, income and history line written in. */
export function applyAftermath(warband: Warband, game: GameSystem, faction: Faction, draft: AftermathDraft, at = new Date()): Warband {
	const rules = game.aftermath;
	if (!rules) return warband;
	const earned = rules.income(warband, game, draft.result, draft.shards);
	const record = battleRecord(draft, at);
	const rows = new Map(draft.rows.map((r) => [r.instanceId, r]));
	return {
		...warband,
		gold: earned.gold,
		tally: earned.tally,
		...(record ? { history: [...(warband.history ?? []), record] } : {}),
		fighters: warband.fighters.map((before) => {
			/* The injury first, as the aftermath rolls it first: a level of renown it brings is there before the experience. */
			const rolled = draft.out.includes(before.instanceId) ? draft.injuries[before.instanceId] : undefined;
			const type = faction.fighters.find((f) => f.id === before.fighterId);
			const fighter = rolled && type && game.injuries ? game.injuries.apply(before, type, faction, rolled) : before;
			const row = rows.get(fighter.instanceId);
			const points = row ? xpEarned(row, draft.bonus) : 0;
			return points > 0 ? rules.gainXp(fighter, points) : fighter;
		})
	};
}
