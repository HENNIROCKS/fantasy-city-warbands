<script lang="ts">
	import RichText from '$lib/components/RichText.svelte';
	import type { Faction, FighterInstance, GameSystem, Issue, WargearKind } from '$lib/core/types';
	import { fighterCost, formatStat } from '$lib/core/warband';

	let {
		instance,
		game,
		faction,
		issues,
		blocked,
		onremove
	}: {
		instance: FighterInstance;
		game: GameSystem;
		faction: Faction;
		/** Only the issues that belong to this fighter. */
		issues: Issue[];
		/** What would stop this fighter from being given a piece of wargear, or null. */
		blocked: (wargearId: string) => Issue | null;
		onremove: () => void;
	} = $props();

	const KINDS: { kind: WargearKind; label: string }[] = [
		{ kind: 'melee', label: 'Melee weapons' },
		{ kind: 'ranged', label: 'Ranged weapons' },
		{ kind: 'armour', label: 'Armour' },
		{ kind: 'item', label: 'Items' }
	];

	const fighter = $derived(faction.fighters.find((f) => f.id === instance.fighterId));
	const label = $derived(instance.name || fighter?.name || instance.fighterId);

	function nameOf(id: string): string {
		return faction.wargear.find((w) => w.id === id)?.name ?? id;
	}

	function add(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		if (select.value) instance.wargear.push(select.value);
		select.value = '';
	}
</script>

<article class="space-y-3 rounded-md border border-zinc-700 bg-zinc-800 p-3">
	<div class="flex items-start gap-2">
		<div class="min-w-0 flex-1">
			<input
				class="field-input font-semibold"
				bind:value={instance.name}
				placeholder={fighter?.name ?? instance.fighterId}
				aria-label="Fighter name"
			/>
			<p class="mt-1 text-zinc-400">
				{fighter?.name ?? instance.fighterId} · {fighterCost(instance, faction)}&nbsp;{game.currency}
			</p>
		</div>
		<button
			type="button"
			class="min-h-11 shrink-0 rounded px-3 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
			aria-label="Remove {label}"
			onclick={onremove}>Remove</button
		>
	</div>

	{#if fighter}
		<div class="grid gap-1 text-center" style="grid-template-columns: repeat({game.stats.length}, minmax(0, 1fr))">
			{#each game.stats as stat (stat.key)}
				<div>
					<span class="sublabel truncate">
						{#if stat.short}
							<abbr class="no-underline sm:hidden" title={stat.label}>{stat.short}</abbr><span class="hidden sm:inline"
								>{stat.label}</span
							>
						{:else}
							{stat.label}
						{/if}
					</span>
					<span class="block rounded bg-zinc-900 py-1 font-semibold text-zinc-200">
						{formatStat(stat, fighter.profile[stat.key])}
					</span>
				</div>
			{/each}
		</div>

		{#if fighter.rules.length}
			<details>
				<summary class="cursor-pointer text-zinc-400">
					{fighter.rules.map((r) => r.name).join(', ')}
				</summary>
				{#each fighter.rules as rule (rule.name)}
					<div class="mt-2 text-zinc-300">
						<strong>{rule.name}</strong>
						<RichText text={rule.text} />
					</div>
				{/each}
			</details>
		{/if}

		<div class="flex flex-wrap gap-2">
			{#each fighter.gear as id (id)}
				<span class="pill pill-static" title="Always carried">{nameOf(id)}</span>
			{/each}
			{#each instance.wargear as id, index (index)}
				{@const item = faction.wargear.find((w) => w.id === id)}
				<button
					type="button"
					class="pill"
					aria-label="Remove {nameOf(id)} from {label}"
					onclick={() => instance.wargear.splice(index, 1)}
				>
					{nameOf(id)} · {item?.cost ?? 0} <span aria-hidden="true">✕</span>
				</button>
			{/each}
			{#if fighter.wargear.length}
				<select class="pill" aria-label="Add wargear to {label}" onchange={add}>
					<option value="">+ Wargear</option>
					{#each KINDS as { kind, label: group } (kind)}
						{@const options = faction.wargear.filter((w) => w.kind === kind && fighter.wargear.includes(w.id))}
						{#if options.length}
							<optgroup label={group}>
								{#each options as w (w.id)}
									{@const block = blocked(w.id)}
									<option value={w.id} disabled={!!block}>
										{w.name} · {w.cost}{block ? ` – ${block.short}` : ''}
									</option>
								{/each}
							</optgroup>
						{/if}
					{/each}
				</select>
			{/if}
		</div>
	{/if}

	{#if issues.length}
		<ul style="color: var(--ui-warn-text)">
			{#each issues as issue, i (i)}
				<li>{issue.message}</li>
			{/each}
		</ul>
	{/if}
</article>
