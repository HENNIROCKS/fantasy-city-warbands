/**
 * The battle level: what every fighter has taken in the battle running right
 * now. Laid out as the Wyrdcry Warband Deck's, which also tracks activations,
 * rounds and morale; this keeps its shape so they can join it.
 *
 * Kept apart from the warband. It lives on this device only, is thrown away
 * when the battle ends, and never changes the warband itself.
 *
 * Health is not known here. Whoever allocates damage hands the figure in, so
 * this module stays free of game data and of the card that works it out.
 */

export interface FighterBattleState {
	/** Damage points allocated. The card shows what is left of Health instead. */
	damage: number;
	/**
	 * Stored rather than worked out from `damage` and Health: Health is a figure
	 * of the card, and the strokes over the deck and the count of who is out ask
	 * for the state without having a card at hand.
	 */
	out: boolean;
}

export interface BattleState {
	startedAt: string;
	/**
	 * Keyed by instanceId. Ids the warband no longer has are ignored on read, and
	 * a record written before a field existed reads as that field's default.
	 */
	fighters: Record<string, Partial<FighterBattleState>>;
}

/** What a fighter carries before anything has happened to it. */
export const FRESH: FighterBattleState = { damage: 0, out: false };

export function start(): BattleState {
	return { startedAt: new Date().toISOString(), fighters: {} };
}

/** Everything about one fighter, with every field the record lacks defaulted. */
export function stateOf(battle: BattleState | null, instanceId: string): FighterBattleState {
	const stored = battle?.fighters[instanceId];
	return stored ? { ...FRESH, ...stored } : FRESH;
}

/**
 * Allocates or takes back damage points, starting a battle if none is running:
 * the first tap at the table is the start of the game. A fighter holding damage
 * equal to its Health is out of action, and anything past that is discarded.
 */
export function allocate(battle: BattleState | null, instanceId: string, delta: number, health: number): BattleState {
	const current = battle ?? start();
	const ceiling = Math.max(0, health);
	const damage = Math.min(ceiling, Math.max(0, stateOf(current, instanceId).damage + delta));
	return {
		...current,
		fighters: { ...current.fighters, [instanceId]: { damage, out: health > 0 && damage >= health } }
	};
}

/** How many of the given fighters are out of action. */
export function outOfAction(battle: BattleState | null, instanceIds: string[]): number {
	return instanceIds.filter((id) => stateOf(battle, id).out).length;
}
