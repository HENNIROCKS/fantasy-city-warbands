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

import { LEADER, activeEffects, isGrouped, limitOf } from './effects';
import { canLead, lostLeader, recruitedLeader } from './leader';
import { findIssues } from './finds';
import { fighterCost } from './warband';
import type { Faction, Fighter, FighterChoice, GameSystem, Issue, Span, Warband } from './types';

function describe(span: Span): string {
	if (span.max === null) return `at least ${span.min}`;
	if (span.min === span.max) return `exactly ${span.min}`;
	return `${span.min}-${span.max}`;
}

/**
 * What a fighter's choice asks for, named so it does not read as the fighter
 * itself missing: `choose one magical ability`, or for a roll the table it is
 * rolled on.
 */
function asked(choice: FighterChoice, tooMany: boolean): string {
	const count = choice.pick === 1 ? 'one' : String(choice.pick);
	if (choice.roll) {
		const results = choice.pick === 1 ? 'result' : 'results';
		return `enter ${tooMany ? `only ${count}` : choice.pick === 1 ? 'the' : count} ${results} rolled on the ${choice.roll}`;
	}
	const noun = choice.noun ?? { one: 'option', many: 'options' };
	return `choose ${tooMany ? 'only ' : ''}${count} ${choice.pick === 1 ? noun.one : noun.many}`;
}

/** Whether a count falls short of a span, exceeds it, or neither. */
function compare(count: number, span: Span): 'missing' | 'excess' | null {
	if (count < span.min) return 'missing';
	if (span.max !== null && count > span.max) return 'excess';
	return null;
}

/**
 * What the warband has spent: every fighter's cost, everything they carry and
 * everything in its stash.
 */
export function warbandCost(warband: Warband, faction: Faction): number {
	const effects = activeEffects(warband, faction);
	const wargear = new Map(faction.wargear.map((w) => [w.id, w]));

	let total = 0;
	for (const instance of warband.fighters) total += fighterCost(instance, faction, effects);
	for (const id of warband.stash ?? []) total += wargear.get(id)?.cost ?? 0;
	return total;
}

/** The whole purse the warband's cost is held against. */
export function purse(warband: Warband, game: GameSystem): number {
	return warband.gold ?? game.budget;
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
	const gold = purse(warband, game);
	if (cost > gold) {
		issues.push({
			code: 'over-budget',
			kind: 'excess',
			message: `${cost} ${game.currency} spent of ${gold} ${game.currency}.`,
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

	/* Who counts towards the limits, each with the keywords it counts under: a
	   dead leader still on the roster counts for nothing, and a fighter that
	   took the lead counts as a LEADER. */
	const resolved: { fighter: Fighter; keywords: string[] }[] = [];
	const successor = warband.fighters.find((f) => f.leader);
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
		if (!(instance.away === 'dead' && recruitedLeader(instance, faction))) {
			resolved.push({ fighter, keywords: instance.leader && !fighter.keywords.includes(LEADER) ? [...fighter.keywords, LEADER] : fighter.keywords });
		}

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

		for (const refused of game.carry?.(fighter, faction, instance.wargear) ?? []) {
			issues.push({ code: 'wargear-carry', kind: 'excess', ...refused, instanceId: instance.instanceId });
		}

		const choice = fighter.choice;
		if (choice) {
			const picked = instance.picks ?? [];
			const options = new Set(choice.options.map((o) => o.id));
			const valid = new Set(picked.filter((id) => options.has(id)));
			const tooMany = valid.size > choice.pick || valid.size !== picked.length;
			if (tooMany || valid.size < choice.pick) {
				issues.push({
					code: 'fighter-choice',
					kind: tooMany ? 'excess' : 'missing',
					message: `${fighter.name}: ${asked(choice, tooMany)}.`,
					short: tooMany ? `Pick ${choice.pick} only` : 'Choice open',
					instanceId: instance.instanceId
				});
			}
		}
	}

	for (const wargear of faction.wargear) {
		if (wargear.rare === undefined) continue;
		const count = warband.fighters.filter((f) => f.wargear.includes(wargear.id)).length;
		if (count <= wargear.rare) continue;
		issues.push({
			code: 'wargear-rare',
			kind: 'excess',
			message: `${wargear.name}: ${wargear.rare} ${wargear.rare === 1 ? 'fighter' : 'fighters'} of the warband may carry it, ${count} do.`,
			short: `Only ${wargear.rare} per warband`
		});
	}

	for (const fighter of faction.fighters) {
		const count = resolved.filter((r) => r.fighter.id === fighter.id).length;
		const isLeader = fighter.keywords.includes(LEADER);
		/* A fighter that took the lead leaves no place for another leader. */
		const { limit, source } = successor && isLeader ? { limit: { min: 0, max: 0 }, source: null } : limitOf(fighter, effects);
		const kind = compare(count, limit);
		if (!kind) continue;

		let message = `${fighter.name}: ${describe(limit)}${source ? ` with ${source}` : ''}, this warband has ${count}.`;
		let short = kind === 'excess' ? 'Limit reached' : `${fighter.name} needed`;
		const lost = game.succession && kind === 'missing' && isLeader && lostLeader(warband);
		const heir = lost && warband.fighters.some((f) => canLead(f, faction, game));
		if (successor && isLeader) {
			message = `${fighter.name}: ${successor.name.trim() || 'a fighter'} leads the warband in its place.`;
			short = 'Already led';
		} else if (heir && game.succession) {
			message = `No leader: a ${game.succession.keyword.toUpperCase()} takes the lead on the back of its card.`;
			short = 'No leader';
		} else if (lost && game.succession && warband.disbanded) {
			message = game.succession.none;
			short = 'Disbanded';
		} else if (lost && game.succession) {
			/* Taken back from disbanding, or brought in without it: the warband builds on. */
			message = `No leader: recruit a ${game.succession.keyword.toUpperCase()} to take the lead.`;
			short = 'No leader';
		} else if (source && limit.max === 0) {
			message = `${fighter.name} cannot be recruited with ${source}.`;
			short = `Not with ${source}`;
		} else if (source && kind === 'missing' && fighter.keywords.includes('leader')) {
			message = `${source}: the warband must be led by a ${fighter.name}.`;
		}
		issues.push({ code: 'fighter-limit', kind, message, short });
	}

	const leading = warband.fighters.filter((f) => f.leader);
	if (leading.length > 1) {
		issues.push({
			code: 'leaders',
			kind: 'excess',
			message: `One fighter leads the warband in its leader's place, this warband has ${leading.length}: ${leading.map((f) => f.name.trim() || 'Unnamed fighter').join(', ')}.`,
			short: 'Already led'
		});
	}

	for (const group of game.groups) {
		const count = resolved.filter((r) => r.keywords.includes(group.keyword) && isGrouped(r.fighter.id, effects)).length;
		const kind = compare(count, group.limit);
		if (!kind) continue;
		issues.push({
			code: 'group-limit',
			kind,
			message: `${group.label}: ${describe(group.limit)}, this warband has ${count}.`,
			short: kind === 'excess' ? `${group.label} full` : `${group.label} needed`
		});
	}

	for (const ratio of faction.ratios ?? []) {
		const count = resolved.filter((r) => r.keywords.includes(ratio.keyword)).length;
		const per = resolved.filter((r) => r.keywords.includes(ratio.per)).length;
		if (count <= ratio.max * per) continue;
		const [many, one] = [ratio.keyword, ratio.per].map((k) => k.replaceAll('-', ' ').toUpperCase());
		issues.push({
			code: 'ratio',
			kind: 'excess',
			message: `${ratio.rule}: at most ${ratio.max} ${many} for each ${one}, this warband has ${count} to ${per}.`,
			short: `${ratio.max} ${many} per ${one}`
		});
	}

	issues.push(...(game.advancement?.check?.(warband, faction) ?? []));

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

	issues.push(...findIssues(warband, game, faction));

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
