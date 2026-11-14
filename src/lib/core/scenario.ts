/**
 * The scenario a battle is fought to and its twist, where the game rolls for
 * them before each battle (`GameSystem.scenarios`). The dice are rolled at the
 * table and the results tapped; both are kept with the battle.
 */

import { marked, start, withoutGroups, type BattleState, type Score } from './battle';
import type { CardValue } from './card';
import { fieldedCost } from './deployment';
import type { BattleMark, Faction, GameSystem, Scenario, ScenarioScore, ScenarioSection, Twist, Warband } from './types';
import { underdogSide } from './underdog';

/** The headings a scenario's rules fold under, as the rulebooks print them. */
const PHASES: Record<ScenarioSection['phase'], string> = { before: 'Before the battle', during: 'During the battle', campaign: 'Campaign' };
const PHASE_ORDER = Object.keys(PHASES);

/** The scenario picked for the battle and its twist; null where none is picked or the game has none. */
export function scenarioOf(game: GameSystem, battle: BattleState | null): { scenario: Scenario; twist: Twist | null } | null {
	const picked = battle?.scenario;
	const scenario = picked && game.scenarios?.list.find((s) => s.id === picked.id);
	if (!picked || !scenario) return null;
	return { scenario, twist: twistsOf(game, scenario).list.find((t) => t.roll === picked.twist) ?? null };
}

/** The twists a scenario is rolled for: its own, else those the game's scenarios share. */
export function twistsOf(game: GameSystem, scenario: Scenario): { roll: string; list: Twist[] } {
	return { roll: scenario.twistRoll ?? game.scenarios?.twistRoll ?? '', list: scenario.twists ?? game.scenarios?.twists ?? [] };
}

/** The battle without the marks the scenario picked brings, which belong to it alone. */
function withoutScenarioMarks(game: GameSystem, battle: BattleState): BattleState {
	const own = new Set((game.battle?.marks ?? []).map((m) => m.key));
	const gone = (scenarioOf(game, battle)?.scenario.marks ?? []).map((m) => m.key).filter((key) => !own.has(key));
	if (!gone.length) return battle;
	const fighters = Object.fromEntries(
		Object.entries(battle.fighters).map(([id, state]) => [id, { ...state, marks: Object.fromEntries(Object.entries(state.marks ?? {}).filter(([key]) => !gone.includes(key))) }])
	);
	return { ...battle, fighters };
}

/**
 * The battle with the scenario picked, starting it if none is running, as
 * hiring does; another scenario drops the twist, the points and the marks,
 * which belong to the one before. Null takes the scenario back.
 */
export function setScenario(game: GameSystem, battle: BattleState | null, id: string | null): BattleState | null {
	if (id === null) {
		if (!battle?.scenario) return battle;
		const { scenario: _picked, score: _scored, ...rest } = withoutScenarioMarks(game, withoutGroups(battle, game.scenarios?.reserve));
		return rest;
	}
	const current = battle ?? start();
	if (current.scenario?.id === id) return current;
	const { score: _scored, ...rest } = withoutScenarioMarks(game, withoutGroups(current, game.scenarios?.reserve));
	return { ...rest, scenario: { id, twist: null } };
}

/**
 * The points both warbands have scored to the scenario; `over` where the battle
 * ends with this round, or at once where the score `counts` a mark.
 */
export type ScoreState = ScenarioScore & Score & { over: boolean };

/**
 * The points as they stand, where the scenario picked counts them. Where it
 * `counts` a mark, the warband's own are the fighters carrying it and only the
 * opponent's are entered.
 */
export function scoreOf(game: GameSystem, battle: BattleState | null): ScoreState | null {
	const rules = scenarioOf(game, battle)?.scenario.score;
	if (!rules) return null;
	const entered = battle?.score ?? { us: 0, them: 0 };
	const us = rules.counts ? marked(battle, Object.keys(battle?.fighters ?? {}), rules.counts) : entered.us;
	const { them } = entered;
	return { ...rules, us, them, over: Math.max(us, them) >= rules.ends && (!!rules.counts || us !== them) };
}

/** The marks a fighter can carry in the battle: the game's, then those the scenario picked brings. */
export function battleMarks(game: GameSystem, battle: BattleState | null): BattleMark[] {
	return [...(game.battle?.marks ?? []), ...(scenarioOf(game, battle)?.scenario.marks ?? [])];
}

/** Whether the warband takes the game's flee test: not where the scenario picked spares its side, once the underdog is answered. */
export function takesFleeTest(game: GameSystem, warband: Warband, battle: BattleState | null): boolean {
	const spared = scenarioOf(game, battle)?.scenario.noFleeTest;
	if (!spared) return true;
	return underdogSide(game.underdog, warband, battle) !== (spared === 'underdog' ? 'you' : 'opponent');
}

/** The battle with the twist picked by its roll, or taken back with null; only once a scenario is picked. */
export function setTwist(battle: BattleState | null, roll: number | null): BattleState | null {
	if (!battle?.scenario) return battle;
	return { ...battle, scenario: { ...battle.scenario, twist: roll } };
}

/* Whether the warband is the underdog, as its own card answers it. */
const SIDES = { you: 'Yes', opponent: 'No', 'roll-off': 'Roll off' } as const;

/**
 * What the battle was set up with, for the box across the warband card: what
 * is fielded against the game's Deployment Limit, the underdog where the game
 * names it without bonuses, the scenario and its twist, each value opening its
 * rules. Empty where nothing is picked and the game sets no Deployment Limit.
 */
export function setupValues(game: GameSystem, warband: Warband, faction: Faction, battle: BattleState | null): CardValue[] {
	const rows: CardValue[] = [];
	if (game.deployment) rows.push({ key: 'fielded', label: 'Fielded', value: `${fieldedCost(game, warband, faction, battle)} / ${game.deployment}` });
	const rules = game.underdog;
	const side = rules?.text ? underdogSide(rules, warband, battle) : null;
	if (rules?.text && side && battle?.underdog) {
		rows.push({
			key: 'underdog',
			label: 'Underdog',
			value: SIDES[side],
			explanation: {
				title: 'Underdog',
				result: SIDES[side],
				facts: [
					{ label: `Your ${rules.figure}`, value: String(rules.reputation(warband)) },
					{ label: `Opponent's ${rules.figure}`, value: String(battle.underdog.opponent) }
				],
				rules: [{ label: `The lesser ${rules.figure}`, text: rules.text }]
			}
		});
	}
	const picked = scenarioOf(game, battle);
	if (!picked) return rows;
	const { scenario, twist } = picked;
	rows.push({
		key: 'scenario',
		label: game.scenarios?.label ?? 'Scenario',
		value: scenario.name,
		explanation: {
			title: scenario.name,
			rules: [
				{ label: `${game.scenarios?.label ?? 'Scenario'} ${scenario.roll}`, text: `*${scenario.intro}*` },
				...[...scenario.sections, ...(game.scenarios?.sections ?? [])]
					.sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase))
					.map((s) => ({ label: s.name, text: s.text, group: PHASES[s.phase] }))
			]
		}
	});
	const twistLabel = game.scenarios?.twistLabel ?? 'Twist';
	if (twist) {
		rows.push({
			key: 'twist',
			label: twistLabel,
			value: twist.name,
			explanation: { title: twist.name, rules: [{ label: `${twistLabel} ${twist.roll} of ${scenario.name}`, text: twist.text }] }
		});
	}
	return rows;
}
