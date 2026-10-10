<script lang="ts">
	import RichText from '$lib/components/RichText.svelte';
	import { roleKeyOf } from '$lib/core/warband';
	import type { Faction, GameSystem, Span } from '$lib/core/types';

	let { faction, game }: { faction: Faction; game: GameSystem } = $props();

	/*
	 * Where the game counts fighters in groups, as Black Death City does, the
	 * list follows them like the rulebook's Fighters List: "Leaders (1)" and so
	 * on, with a fighter's own limit only where it is tighter. A game without
	 * groups but with role headings, as Wyrdcry, lists the fighters under their
	 * role as roleKeyOf finds it; the heading sets no limit there, so each
	 * fighter's limit stays the whole story. Without either it is one list.
	 */
	const sections = $derived.by(() => {
		const labels = game.roleLabels;
		if (!game.groups.length && !labels) return [{ label: null as string | null, limited: false, fighters: faction.fighters }];
		const grouped = game.groups.length
			? game.groups.map((g) => ({
					label: `${g.label} (${span(g.limit)})`,
					limited: true,
					fighters: faction.fighters.filter((f) => f.keywords.includes(g.keyword))
				}))
			: game.roles
					.filter((r) => labels?.[r])
					.map((r) => ({
						label: labels![r],
						limited: false,
						fighters: faction.fighters.filter((f) => roleKeyOf(f, game) === r)
					}));
		const placed = new Set(grouped.flatMap((s) => s.fighters));
		const rest = faction.fighters.filter((f) => !placed.has(f));
		return [...grouped, ...(rest.length ? [{ label: 'Other', limited: false, fighters: rest }] : [])].filter((s) => s.fighters.length);
	});

	function span(limit: Span): string {
		if (limit.max === null) return limit.min ? `${limit.min}+` : 'any';
		if (limit.min === limit.max) return `${limit.min}`;
		return `${limit.min}–${limit.max}`;
	}
</script>

<div class="space-y-4">
	<div>
		<p class="field-label">Fighters</p>
		<table class="w-full text-left">
			<thead class="sr-only">
				<tr><th>Fighter</th><th>Cost</th><th>How many</th></tr>
			</thead>
			{#each sections as section (section.label)}
				<tbody>
					{#if section.label}
						<tr>
							<th colspan="3" class="pt-3 pb-1 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
								{section.label}
							</th>
						</tr>
					{/if}
					{#each section.fighters as f (f.id)}
						{@const limit = section.limited && f.limit.max === null && !f.limit.min ? '' : span(f.limit)}
						<tr class="border-t border-zinc-700">
							<td class="py-1.5 pr-2 text-zinc-200">{f.name}</td>
							<td class="py-1.5 pr-2 text-right whitespace-nowrap text-zinc-300">{f.cost}&nbsp;{game.currency}</td>
							<td class="w-12 py-1.5 text-right text-zinc-400">{limit}</td>
						</tr>
					{/each}
				</tbody>
			{/each}
		</table>
	</div>

	{#each faction.choices as choice (choice.id)}
		<div>
			<p class="field-label">{choice.name} <span class="font-normal normal-case">· pick {choice.pick}</span></p>
			<p class="text-zinc-300">{choice.options.map((o) => o.name).join(', ')}</p>
		</div>
	{/each}

	{#if faction.rules.length}
		<div>
			<p class="field-label">Rules</p>
			<div class="space-y-1">
				{#each faction.rules as rule (rule.name)}
					<details>
						<summary class="cursor-pointer py-1 font-semibold text-zinc-200">{rule.name}</summary>
						<div class="pb-2 text-zinc-300"><RichText text={rule.text} /></div>
					</details>
				{/each}
			</div>
		</div>
	{/if}

	<p class="text-zinc-400">
		{faction.origin === 'homebrew' ? 'Homebrew' : 'Official'} · by {faction.author}
	</p>
</div>
