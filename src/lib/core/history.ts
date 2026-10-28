/**
 * A warband's battles as the player wrote them down, read the way the Wyrdcry
 * Warband Deck reads them: newest first, dated so no reader takes the day for
 * the month, and counted up. Every game asks for the result as a battle ends
 * and adds the line here; where it has an aftermath, that asks it on its first
 * page (`aftermath.ts`).
 */

import type { BattleState } from './battle';
import type { BattleRecord, Warband } from './types';
import { newId } from './warband';

export const RESULT_LABELS: Record<BattleRecord['result'], string> = {
	win: 'Win',
	draw: 'Draw',
	loss: 'Loss'
};

/**
 * Newest first. Two battles on the same day keep the order they were entered
 * in, the later one on top – the date alone cannot tell them apart.
 */
export function newestFirst(records: BattleRecord[]): BattleRecord[] {
	return records
		.map((record, index) => ({ record, index }))
		.sort((a, b) => b.record.date.localeCompare(a.record.date) || b.index - a.index)
		.map(({ record }) => record);
}

/* A day as the phone's own calendar has it, today unless told otherwise –
   `toISOString` is UTC and would date a late game to the next morning. */
export function today(at = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** What ending a battle asks before it goes into the history. */
export interface BattleEnd {
	result: BattleRecord['result'] | null;
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

/** Nothing answered yet, read from the day the battle started on. */
export function startBattleEnd(battle: BattleState | null, history: BattleRecord[] = []): BattleEnd {
	const since = today(battle ? new Date(battle.startedAt) : undefined);
	const recorded = history.filter((r) => r.date >= since).at(-1) ?? null;
	return { result: null, record: recorded === null, opponentWarband: '', opponentPlayer: '', recorded };
}

/** The battle's line in the history, or null where none is to be added. */
export function battleRecord(end: BattleEnd, at = new Date()): BattleRecord | null {
	if (!end.record || !end.result) return null;
	return {
		id: newId(),
		date: today(at),
		result: end.result,
		opponentWarband: end.opponentWarband.trim(),
		opponentPlayer: end.opponentPlayer.trim()
	};
}

/** The warband with the battle's line added, where one is to be. */
export function recordBattle(warband: Warband, end: BattleEnd, at = new Date()): Warband {
	const record = battleRecord(end, at);
	return record ? { ...warband, history: [...(warband.history ?? []), record] } : warband;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-09-19` as `19 Sep 2026`, spelled out here rather than by the phone's locale, so it stays English like the app. */
export function displayDate(date: string): string {
	const [year, month, day] = date.split('-');
	const name = MONTHS[Number(month) - 1];
	return name && day ? `${Number(day)} ${name} ${year}` : date;
}

/** The opposing warband, the player behind it in brackets – either may be missing. */
export function opponent(record: BattleRecord): string {
	const warband = record.opponentWarband.trim();
	const player = record.opponentPlayer.trim();
	if (!player) return warband;
	return warband ? `${warband} (${player})` : `(${player})`;
}

/** Won, drawn and lost. */
export function results(records: BattleRecord[]): [number, number, number] {
	const count = (result: BattleRecord['result']) => records.filter((r) => r.result === result).length;
	return [count('win'), count('draw'), count('loss')];
}

/** `2 won · 1 drawn · 0 lost`. */
export function tally(records: BattleRecord[]): string {
	const [won, drawn, lost] = results(records);
	return `${won} won · ${drawn} drawn · ${lost} lost`;
}
