/**
 * The checks every game system shares. Each returns what it found rather than
 * stopping at the first problem, so a warband being built can show all of them
 * at once.
 *
 * An issue is one of two kinds. `missing` is a warband not finished yet – no
 * leader, too few henchmen, a choice still open – and is simply where building
 * stands. `excess` is a warband that has gone too far – over budget, over a
 * limit – and the building steps never let it happen: they try each change
 * against these checks first and refuse the ones that would bring a new excess.
 */

import { activeEffects, isGrouped, limitOf } from './effects';
import type { Faction, Fighter, GameSystem, Issue, Span, Warband } from './types';

function describe(span: Span): string {
	if (span.max === null) return `at least ${span.min}`;
	if (span.min === span.max) return `exactly ${span.min}`;
	return `${span.min}-${span.max}`;
}

/** Whether a count falls short of a span, exceeds it, or neither. */
function compare(count: number, span: Span): 'missing' | 'excess' | null {
	if (count < span.min) return 'missing';
	if (span.max !== null && count > span.max) return 'excess';
	return null;
}

/** What the warband has spent: every fighter's cost and everything they carry. */
export function warbandCost(warband: Warband, faction: Faction): number {
	const fighters = new Map(faction.fighters.map((f) => [f.id, f]));
	const wargear = new Map(faction.wargear.map((w) => [w.id, w]));

	let total = 0;
	for (const instance of warband.fighters) {
		total += fighters.get(instance.fighterId)?.cost ?? 0;
		for (const id of instance.wargear) total += wargear.get(id)?.cost ?? 0;
	}
	return total;
}

export function validate(warband: Warband, game: GameSystem, faction: Faction): Issue[] {
	if (warband.game !== game.id || warband.factionId !== faction.id || faction.game !== game.id) {
		const message = `${warband.factionId} is not a faction of ${game.name}.`;
		return [{ code: 'unknown-faction', kind: 'excess', message, short: 'Unknown faction' }];
	}

	const issues: Issue[] = [];
	const fighters = new Map(faction.fighters.map((f) => [f.id, f]));
	const effects = activeEffects(warband, faction);

	const cost = warbandCost(warband, faction);
	if (cost > game.budget) {
		issues.push({
			code: 'over-budget',
			kind: 'excess',
			message: `${cost} ${game.currency} spent of ${game.budget} ${game.currency}.`,
			short: `Not enough ${game.currency}`
		});
	}

	const size = compare(warband.fighters.length, faction.size);
	if (size) {
		issues.push({
			code: 'size',
			kind: size,
			message: `A warband has ${describe(faction.size)} fighters, this one has ${warband.fighters.length}.`,
			short: size === 'excess' ? 'Warband full' : 'Too few fighters'
		});
	}

	const resolved: Fighter[] = [];
	for (const instance of warband.fighters) {
		const fighter = fighters.get(instance.fighterId);
		if (!fighter) {
			issues.push({
				code: 'unknown-fighter',
				kind: 'excess',
				message: `${instance.fighterId} is not a fighter of ${faction.name}.`,
				short: 'Unknown fighter',
				instanceId: instance.instanceId
			});
			continue;
		}
		resolved.push(fighter);

		const allowed = new Set(fighter.wargear);
		for (const id of instance.wargear) {
			if (!allowed.has(id)) {
				const name = faction.wargear.find((w) => w.id === id)?.name ?? id;
				issues.push({
					code: 'wargear-not-allowed',
					kind: 'excess',
					message: `${fighter.name} cannot be given ${name}.`,
					short: 'Not allowed',
					instanceId: instance.instanceId
				});
			}
		}
	}

	for (const fighter of faction.fighters) {
		const count = resolved.filter((f) => f.id === fighter.id).length;
		const { limit, source } = limitOf(fighter, effects);
		const kind = compare(count, limit);
		if (!kind) continue;

		let message = `${fighter.name}: ${describe(limit)}${source ? ` with ${source}` : ''}, this warband has ${count}.`;
		let short = kind === 'excess' ? 'Limit reached' : `${fighter.name} needed`;
		if (source && limit.max === 0) {
			message = `${fighter.name} cannot be recruited with ${source}.`;
			short = `Not with ${source}`;
		} else if (source && kind === 'missing' && fighter.keywords.includes('leader')) {
			message = `${source}: the warband must be led by a ${fighter.name}.`;
		}
		issues.push({ code: 'fighter-limit', kind, message, short });
	}

	for (const group of game.groups) {
		const count = resolved.filter((f) => f.keywords.includes(group.keyword) && isGrouped(f.id, effects)).length;
		const kind = compare(count, group.limit);
		if (!kind) continue;
		issues.push({
			code: 'group-limit',
			kind,
			message: `${group.label}: ${describe(group.limit)}, this warband has ${count}.`,
			short: kind === 'excess' ? `${group.label} full` : `${group.label} needed`
		});
	}

	for (const choice of faction.choices) {
		const picked = warband.picks[choice.id] ?? [];
		const options = new Set(choice.options.map((o) => o.id));
		const valid = new Set(picked.filter((id) => options.has(id)));
		const tooMany = valid.size > choice.pick || valid.size !== picked.length;
		if (tooMany || valid.size < choice.pick) {
			issues.push({
				code: 'choice',
				kind: tooMany ? 'excess' : 'missing',
				message: `${choice.name}: pick ${choice.pick}, ${valid.size} picked.`,
				short: tooMany ? `Pick ${choice.pick} only` : `${choice.name} open`
			});
		}
	}

	return issues;
}

/**
 * The first excess a change would bring that the warband does not have yet, or
 * null where the change keeps it within its limits. Excesses already there –
 * a warband saved before a limit was known – do not block every other change.
 */
export function newExcess(before: Issue[], after: Warband, game: GameSystem, faction: Faction): Issue | null {
	const known = new Set(before.filter((i) => i.kind === 'excess').map((i) => i.message));
	return validate(after, game, faction).find((i) => i.kind === 'excess' && !known.has(i.message)) ?? null;
}
