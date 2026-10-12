/**
 * The battle level: the round, who has acted in it, and what every fighter has
 * taken. Laid out as the Wyrdcry Warband Deck's.
 *
 * Kept apart from the warband. It lives on this device only, is thrown away
 * when the battle ends, and never changes the warband itself.
 *
 * Health is not known here. Whoever allocates damage hands the figure in, so
 * this module stays free of game data and of the card that works it out.
 */

/**
 * What a fighter carries in the battle running right now. `activated` and
 * `waiting` belong to the round and are cleared by the next one; `damage` and
 * `out` belong to the battle.
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
}

/** One round: its number, and what each fighter carries in it. */
export interface BattleRound {
	round: number;
	/**
	 * Keyed by instanceId. Ids the warband no longer has are ignored on read, and
	 * a record written before a field existed reads as that field's default.
	 */
	fighters: Record<string, Partial<FighterBattleState>>;
}

export interface BattleState extends BattleRound {
	startedAt: string;
	/**
	 * The round the last `nextRound` left behind, so a mistaken tap can be taken
	 * back. Null once the new round has been played into – from there on there is
	 * nothing left to return to.
	 */
	undo: BattleRound | null;
}

/** What a fighter carries before anything has happened to it. */
export const FRESH: FighterBattleState = { activated: false, waiting: false, damage: 0, out: false };

export function start(): BattleState {
	return { startedAt: new Date().toISOString(), round: 1, fighters: {}, undo: null };
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
		fighters: stored.fighters ?? {},
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
 * battle: the wounds and whoever is out of action carry over.
 */
export function nextRound(battle: BattleState): BattleState {
	const fighters: Record<string, FighterBattleState> = {};
	for (const [id, state] of Object.entries(battle.fighters)) {
		fighters[id] = { ...FRESH, ...state, activated: false, waiting: false };
	}
	return { ...battle, round: battle.round + 1, fighters, undo: { round: battle.round, fighters: battle.fighters } };
}

/**
 * One step back. There is deliberately no chain of them: what this undoes is a
 * mistap, and a mistap is noticed at once.
 */
export function undoRound(battle: BattleState): BattleState {
	if (!battle.undo) return battle;
	return { ...battle, round: battle.undo.round, fighters: battle.undo.fighters, undo: null };
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
