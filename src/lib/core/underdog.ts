/**
 * The underdog of a battle, as Wyrdcry's optional Underdogs has it (Campaign
 * Book 1.0, p. 30): worked out in the battle's setup from both warbands'
 * figures, before anyone is hired. The opponent's figure is asked for and kept
 * with the battle, so the bonuses follow it when it is corrected; the
 * warband's own is read off the warband.
 */

import { release, start, type BattleState } from './battle';
import type { Underdog, UnderdogBonus, Warband } from './types';

export interface UnderdogState {
	/** How far the warband is behind its opponent. */
	behind: number;
	/** How many bonuses it picks. */
	allowed: number;
	picked: UnderdogBonus[];
	/** What each fighter adds to the aftermath's roll. */
	roll: number;
}

/** How many bonuses a warband `behind` its opponent picks: one for each full gap, as many as there are at most. */
export function bonusesFor(rules: Underdog, behind: number): number {
	return Math.min(rules.bonuses.length, Math.max(0, Math.floor(behind / rules.gap)));
}

/** The warband as the underdog of the battle running; null where it is not one, or nobody asked. */
export function underdogOf(rules: Underdog | undefined, warband: Warband, battle: BattleState | null): UnderdogState | null {
	const asked = battle?.underdog;
	if (!rules || !asked) return null;
	const behind = asked.opponent - rules.reputation(warband);
	const allowed = bonusesFor(rules, behind);
	if (!allowed) return null;
	const picked = rules.bonuses.filter((b) => asked.bonuses.includes(b.id));
	return { behind, allowed, picked, roll: rules.roll };
}

/** The bonus that hires without a fee, where the game has one. */
const freeHire = (rules: Underdog) => rules.bonuses.find((b) => b.effect === 'free-hire')?.id;

/** The hires the last exploring left for nothing, such as Wyrdcry's To the Rescue, besides any debt called in. */
const rescued = (warband: Warband) => (warband.next ?? []).filter((n) => n.freeHire).length;

/**
 * The battle with the opponent's figure, starting it if none is running, as
 * hiring does. Where it now allows fewer bonuses, the last picked go first –
 * the debt called in last of all while a hired sword came of it, and with it
 * that hired sword. Without a battle and without a bonus to pick, nothing is
 * started; with no figure at all, the question is taken back as if never asked.
 */
export function setOpponent(battle: BattleState | null, rules: Underdog, warband: Warband, opponent: number | null): BattleState | null {
	const allowed = opponent === null ? 0 : bonusesFor(rules, opponent - rules.reputation(warband));
	if (!battle && !allowed) return null;
	let current = battle ?? start();
	const debt = freeHire(rules);
	const owed = current.hired.filter((h) => h.free).length > rescued(warband);
	const bonuses = [...(current.underdog?.bonuses ?? [])];
	while (bonuses.length > allowed) {
		const last = bonuses.findLastIndex((id) => !(owed && id === debt));
		bonuses.splice(last >= 0 ? last : bonuses.length - 1, 1);
	}
	/* The hires for nothing beyond what is still owed go, the last hired first. */
	const room = (debt && bonuses.includes(debt) ? 1 : 0) + rescued(warband);
	const free = current.hired.filter((h) => h.free);
	for (const h of free.slice(room)) current = release(current, h.instanceId);
	if (opponent === null) {
		const { underdog: _asked, ...unasked } = current;
		return unasked;
	}
	return { ...current, underdog: { opponent, bonuses } };
}

/** Why a bonus cannot be picked or put back, in a few words for its button; null where it can. */
export function bonusBlocked(rules: Underdog, warband: Warband, battle: BattleState | null, bonus: UnderdogBonus): string | null {
	const state = underdogOf(rules, warband, battle);
	if (!state || !battle) return 'Not the underdog';
	const picked = state.picked.some((b) => b.id === bonus.id);
	if (picked) return bonus.effect === 'free-hire' && battle.hired.filter((h) => h.free).length > rescued(warband) ? 'Send the free hired sword away first' : null;
	if (state.picked.length >= state.allowed) return `${state.allowed} ${state.allowed === 1 ? 'bonus' : 'bonuses'} only`;
	return rules.refuse?.(warband, bonus) ?? null;
}

/** The battle with the bonus picked or put back, where nothing blocks it. */
export function toggleBonus(rules: Underdog, warband: Warband, battle: BattleState | null, bonus: UnderdogBonus): BattleState | null {
	if (!battle?.underdog || bonusBlocked(rules, warband, battle, bonus)) return battle;
	const bonuses = battle.underdog.bonuses;
	const next = bonuses.includes(bonus.id) ? bonuses.filter((id) => id !== bonus.id) : [...bonuses, bonus.id];
	return { ...battle, underdog: { ...battle.underdog, bonuses: next } };
}

/** Whether the next one hired comes without a fee: the debt is called in, or the last exploring left one, and not every one owed is hired yet. */
export function freeHireOpen(state: UnderdogState | null, battle: BattleState | null, warband: Warband): boolean {
	const owed = (state?.picked.some((b) => b.effect === 'free-hire') ? 1 : 0) + rescued(warband);
	return owed > (battle?.hired.filter((h) => h.free).length ?? 0);
}

/** How many standings higher the income is collected at. */
export function standingRaised(state: UnderdogState | null): number {
	return state?.picked.filter((b) => b.effect === 'standing').length ?? 0;
}
