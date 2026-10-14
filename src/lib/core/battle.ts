/**
 * The battle level: the round, who has acted in it, and what every fighter has
 * taken. Laid out as the Wyrdcry Warband Deck's.
 *
 * Kept apart from the warband. It lives on this device only, is thrown away
 * when the battle ends, and never changes the warband itself.
 *
 * Health is not known here. Whoever allocates damage hands the figure in, so
 * this module stays free of game data and of the card that works it out. The
 * marks and stages a game declares arrive the same way, handed in.
 */

import type { BattleMark, CounterStage, StatCondition } from './types';

/**
 * What a fighter carries in the battle running right now. `activated` and
 * `waiting` belong to the round and are cleared by the next one; `damage` and
 * `out` belong to the battle. `marks` holds the states the game declares, each
 * cleared by the round or kept for the battle as the game says.
 */
export interface FighterBattleState {
	activated: boolean;
	/**
	 * Waited as its first action: the activation is over, but the fighter acts
	 * once more this round – so it still counts as one to act. Only where the
	 * game has it (`GameSystem.battle.waiting`).
	 */
	waiting: boolean;
	/** Damage points allocated. The card shows what is left of Health instead. */
	damage: number;
	/**
	 * Stored rather than worked out from `damage` and Health: Health is a figure
	 * of the card, and the strokes over the deck and the count of who is out ask
	 * for the state without having a card at hand.
	 */
	out: boolean;
	/** By the key of a `BattleMark`; a missing key is not marked. */
	marks: Record<string, boolean>;
}

/** One round: its number, and what each fighter carries in it. */
export interface BattleRound {
	round: number;
	/**
	 * Keyed by instanceId. Ids the warband no longer has are ignored on read, and
	 * a record written before a field existed reads as that field's default.
	 */
	fighters: Record<string, Partial<FighterBattleState>>;
	/**
	 * Whether the warband wavered in the morale phase that ended the round
	 * before: every fighter takes the game's test in this one. Missing in a
	 * record written before the field existed, and in the first round.
	 */
	morale?: boolean;
}

export interface BattleState extends BattleRound {
	startedAt: string;
	/** The faction's count through the battle, such as Zeal. It belongs to the battle, not to the round. */
	counter: number;
	/**
	 * The round the last `nextRound` left behind, so a mistaken tap can be taken
	 * back. Null once the new round has been played into – from there on there is
	 * nothing left to return to.
	 */
	undo: BattleRound | null;
}

/** What a fighter carries before anything has happened to it. */
export const FRESH: FighterBattleState = { activated: false, waiting: false, damage: 0, out: false, marks: {} };

export function start(): BattleState {
	return { startedAt: new Date().toISOString(), round: 1, counter: 0, fighters: {}, undo: null };
}

/**
 * A battle as stored, with what a record from before a field existed lacks
 * filled in: a battle that only counted damage reads as round 1.
 */
export function readBattle(stored: Partial<BattleState> | null | undefined): BattleState | null {
	if (!stored) return null;
	return {
		startedAt: stored.startedAt ?? new Date().toISOString(),
		round: stored.round ?? 1,
		counter: stored.counter ?? 0,
		fighters: stored.fighters ?? {},
		morale: stored.morale ?? false,
		undo: stored.undo ?? null
	};
}

/** Everything about one fighter, with every field the record lacks defaulted. */
export function stateOf(battle: BattleState | null, instanceId: string): FighterBattleState {
	const stored = battle?.fighters[instanceId];
	return stored ? { ...FRESH, ...stored } : FRESH;
}

/**
 * Writes one fighter's state, starting a battle if none is running: the first
 * tap at the table is the start of the game.
 */
function write(battle: BattleState | null, instanceId: string, patch: Partial<FighterBattleState>): BattleState {
	const current = battle ?? start();
	return {
		...current,
		fighters: { ...current.fighters, [instanceId]: { ...stateOf(current, instanceId), ...patch } },
		/* The new round has been played into, so the one before it is out of
		   reach – returning to it would drop this tap on the floor. */
		undo: null
	};
}

/** Activated: the fighter is done for this round, so it is no longer waiting. */
export function toggleActivated(battle: BattleState | null, instanceId: string): BattleState {
	return write(battle, instanceId, { activated: !stateOf(battle, instanceId).activated, waiting: false });
}

/**
 * Waiting: the activation is over and the fighter is not done with the round.
 * The two states are exclusive – a fighter that comes back to act is marked
 * activated instead.
 */
export function toggleWaiting(battle: BattleState | null, instanceId: string): BattleState {
	return write(battle, instanceId, { waiting: !stateOf(battle, instanceId).waiting, activated: false });
}

/** A mark the game declares, set or cleared. It neither ends an activation nor excludes another state. */
export function toggleMark(battle: BattleState | null, instanceId: string, key: string): BattleState {
	const marks = stateOf(battle, instanceId).marks;
	return write(battle, instanceId, { marks: { ...marks, [key]: !marks[key] } });
}

/** Counts the faction's count up or down, starting a battle if none is running. It cannot fall below nothing. */
export function adjustCounter(battle: BattleState | null, delta: number): BattleState {
	const current = battle ?? start();
	return { ...current, counter: Math.max(0, current.counter + delta), undo: null };
}

/**
 * Allocates or takes back damage points. A fighter holding damage equal to its
 * Health is out of action, and anything past that is discarded.
 */
export function allocate(battle: BattleState | null, instanceId: string, delta: number, health: number): BattleState {
	const ceiling = Math.max(0, health);
	const damage = Math.min(ceiling, Math.max(0, stateOf(battle, instanceId).damage + delta));
	return write(battle, instanceId, { damage, out: health > 0 && damage >= health });
}

/**
 * The next round clears what belongs to a round and keeps what belongs to the
 * battle: the wounds, whoever is out of action and the marks that last the
 * battle carry over. `roundMarks` are the keys of the marks the round clears.
 * `wavered` is the morale phase between the two rounds: whether the warband
 * wavered as the round ended, so that the new one asks every fighter's test.
 */
export function nextRound(battle: BattleState, roundMarks: string[] = [], wavered = false): BattleState {
	const fighters: Record<string, FighterBattleState> = {};
	for (const [id, state] of Object.entries(battle.fighters)) {
		const marks = { ...state.marks };
		for (const key of roundMarks) delete marks[key];
		fighters[id] = { ...FRESH, ...state, activated: false, waiting: false, marks };
	}
	return {
		...battle,
		round: battle.round + 1,
		fighters,
		morale: wavered,
		undo: { round: battle.round, fighters: battle.fighters, morale: battle.morale ?? false }
	};
}

/**
 * One step back. There is deliberately no chain of them: what this undoes is a
 * mistap, and a mistap is noticed at once.
 */
export function undoRound(battle: BattleState): BattleState {
	if (!battle.undo) return battle;
	return { ...battle, round: battle.undo.round, fighters: battle.undo.fighters, morale: battle.undo.morale ?? false, undo: null };
}

/**
 * How many of the given fighters still have to act this round. A fighter that is
 * waiting counts – it is coming back – and one that is out of action does not.
 */
export function remaining(battle: BattleState | null, instanceIds: string[]): number {
	return instanceIds.filter((id) => {
		const state = stateOf(battle, id);
		return !state.activated && !state.out;
	}).length;
}

/** How many of the given fighters are out of action. */
export function outOfAction(battle: BattleState | null, instanceIds: string[]): number {
	return instanceIds.filter((id) => stateOf(battle, id).out).length;
}

/** Whether as many of the given fighters as `threshold` names for their number are out of action. */
export function isWavering(battle: BattleState | null, instanceIds: string[], threshold: (size: number) => number): boolean {
	if (!battle || !instanceIds.length) return false;
	return outOfAction(battle, instanceIds) >= threshold(instanceIds.length);
}

/** The stages a count has reached, lowest first; the stages arrive sorted. */
export function reached(stages: CounterStage[], counter: number): CounterStage[] {
	return stages.filter((stage) => stage.at <= counter);
}

/** A characteristic the battle moves, and what moves it: `Panicked`, `Zeal 10: Frenzied`. */
export interface BattleLayer {
	stat: string;
	source: string;
	amount: number;
}

/** A rule of the battle that changes a characteristic in one situation only, such as cover. */
export interface BattleCondition extends StatCondition {
	source: string;
}

/**
 * What the battle does to one fighter's card: the marks it carries, by label –
 * those of the round first, as the band above them belongs to the round – and
 * what the marks and the faction's reached stages add to its characteristics,
 * always or in one situation. A stage leaves out the carriers of its `except`
 * keyword.
 */
export function battleEffects(
	state: FighterBattleState,
	marks: BattleMark[],
	stages: CounterStage[],
	counter: { label: string; value: number },
	keywords: string[]
): { labels: string[]; layers: BattleLayer[]; conditions: BattleCondition[] } {
	const set = marks.filter((m) => state.marks[m.key]);
	const ordered = [...set.filter((m) => m.lasts === 'round'), ...set.filter((m) => m.lasts === 'battle')];
	const holding = reached(stages, counter.value).filter((stage) => !stage.except || !keywords.includes(stage.except));
	const sources = [
		...ordered.map((m) => ({ source: m.label, bonus: m.bonus ?? {}, conditions: m.conditions ?? [] })),
		...holding.map((stage) => ({ source: `${counter.label} ${stage.at}: ${stage.label}`, bonus: stage.bonus, conditions: stage.conditions ?? [] }))
	];
	return {
		labels: ordered.map((m) => m.label),
		layers: sources.flatMap(({ source, bonus }) =>
			Object.entries(bonus)
				.filter(([, amount]) => amount !== 0)
				.map(([stat, amount]) => ({ stat, source, amount }))
		),
		conditions: sources.flatMap(({ source, conditions }) => conditions.map((c) => ({ ...c, source })))
	};
}
