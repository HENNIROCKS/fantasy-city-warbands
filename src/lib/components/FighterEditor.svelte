<script lang="ts">
	import RichText from '$lib/components/RichText.svelte';
	import type { Faction, FighterInstance, GameSystem, Issue, WargearKind } from '$lib/core/types';
	import { fighterCost, fighterName, formatStat } from '$lib/core/warband';

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
	const label = $derived(fighterName(instance, faction));

	function nameOf(id: string): string {
		return faction.wargear.find((w) => w.id === id)?.name ?? id;
	}

	function costOf(id: string): number {
		return faction.wargear.find((w) => w.id === id)?.cost ?? 0;
	}

	/* The wargear to pick from opens below the list, as a matrix rather than a select. */
	let adding = $state(false);
	let addButton: HTMLButtonElement | undefined = $state();

	/* Picking closes the matrix, and the picked button with it; focus goes back to where it opened. */
	function pick(id: string) {
		instance.wargear.push(id);
		adding = false;
		addButton?.focus();
	}
</script>

<article id="fighter-{instance.instanceId}" class="scroll-mt-20 space-y-3 rounded-md border border-zinc-700 bg-zinc-800 p-3">
	<!-- The name takes the full width, so the placeholder fits a long fighter type. -->
	<div>
		<input
			class="field-input h-11 font-semibold placeholder:font-normal"
			bind:value={instance.name}
			placeholder="Name your {fighter?.name ?? instance.fighterId}"
			aria-label="Fighter name"
		/>
		<div class="mt-1 flex items-center justify-between gap-2">
			<p class="min-w-0 text-zinc-400">
				{fighter?.name ?? instance.fighterId} · {fighterCost(instance, faction)}&nbsp;{game.currency}
			</p>
			<button
				type="button"
				class="min-h-11 shrink-0 rounded px-3 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
				aria-label="Remove {label}"
				onclick={onremove}>Remove</button
			>
		</div>
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

		<div>
			{#if fighter.gear.length || instance.wargear.length}
				<ul class="space-y-2">
					{#each fighter.gear as id (id)}
						<li class="wargear-row">
							<span class="wargear-cell wargear-fixed">{nameOf(id)}</span>
							<span class="wargear-cell wargear-fixed wargear-cost">always</span>
							<span></span>
						</li>
					{/each}
					{#each instance.wargear as id, index (index)}
						<li class="wargear-row">
							<span class="wargear-cell">{nameOf(id)}</span>
							<span class="wargear-cell wargear-cost">{costOf(id)}&nbsp;{game.currency}</span>
							<button
								type="button"
								class="wargear-remove"
								aria-label="Remove {nameOf(id)} from {label}"
								onclick={() => instance.wargear.splice(index, 1)}><span aria-hidden="true">×</span></button
							>
						</li>
					{/each}
				</ul>
			{/if}
			{#if fighter.wargear.length}
				<button
					type="button"
					class="wargear-add {fighter.gear.length || instance.wargear.length ? 'mt-2' : ''}"
					aria-expanded={adding}
					aria-controls={adding ? `wargear-${instance.instanceId}` : undefined}
					bind:this={addButton}
					onclick={() => (adding = !adding)}>{adding ? 'Close' : '+ Add wargear'}</button
				>
				{#if adding}
					<div id="wargear-{instance.instanceId}" class="mt-3 space-y-3">
						{#each KINDS as { kind, label: group } (kind)}
							{@const options = faction.wargear.filter((w) => w.kind === kind && fighter.wargear.includes(w.id))}
							{#if options.length}
								<div>
									<p class="sublabel">{group}</p>
									<div class="grid grid-cols-2 gap-2">
										{#each options as w (w.id)}
											{@const block = blocked(w.id)}
											<button
												type="button"
												class="choice"
												disabled={!!block}
												onclick={() => pick(w.id)}
											>
												<span class="block font-semibold">{w.name}</span>
												<span class="block text-zinc-400">{w.cost}&nbsp;{game.currency}</span>
												{#if block}
													<span class="block font-semibold" style="color: var(--ui-warn-text)">{block.short}</span>
												{/if}
											</button>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
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
