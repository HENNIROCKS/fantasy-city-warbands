<script lang="ts">
	import RichText from '$lib/components/RichText.svelte';
	import { fighterSections, formatSpan } from '$lib/core/warband';
	import type { Faction, GameSystem } from '$lib/core/types';

	let { faction, game }: { faction: Faction; game: GameSystem } = $props();

	const sections = $derived(fighterSections(faction, game));
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
						{@const limit = section.limited && f.limit.max === null && !f.limit.min ? '' : formatSpan(f.limit)}
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
		{faction.origin === 'homebrew' ? 'Homebrew' : 'Official'} · by {faction.author}{#if faction.source}{' '}·
			<a class="underline" href={faction.source.url} target="_blank" rel="noopener"
				>{faction.source.name}<span aria-hidden="true"> ↗</span></a
			>{/if}
	</p>
</div>
