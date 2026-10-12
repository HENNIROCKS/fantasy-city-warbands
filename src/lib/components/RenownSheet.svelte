<script lang="ts" module>
	/** What a level is spent on: a characteristic, a rule with the weapon it was taken for, or nothing where nothing is left. */
	export type LevelPick = { stat: string; bonus: number } | { rule: string; option?: string } | null;
</script>

<script lang="ts">
	import RichText from '$lib/components/RichText.svelte';
	import type { LevelOffer, LevelRule, OpenLevel } from '$lib/core/types';

	/*
	 * A level of a fighter's to spend, as the Wyrdcry Warband Deck asks it after
	 * a battle: a characteristic, or for a hero a heroic talent, each with the
	 * reason where it cannot be taken. Spending writes at once; Decide later keeps
	 * the level open for the Battle menu.
	 */
	let {
		name,
		label,
		level,
		offer,
		waiting,
		onspend,
		onclose
	}: {
		name: string;
		/** What a level is called: `Renown`. */
		label: string;
		level: OpenLevel;
		offer: LevelOffer;
		/** Further levels still open after this one. */
		waiting: number;
		/** The pick confirmed, or null where nothing could be taken. */
		onspend: (pick: LevelPick) => void | Promise<void>;
		onclose: () => void;
	} = $props();

	const anyStat = $derived(offer.stats.some((s) => s.blocked === null));
	const anyRule = $derived(offer.rules.some((g) => g.options.some((o) => o.blocked === null)));

	/* What is picked belongs to the level it was picked for: the sheet stays while
	   the next level comes in. */
	const at = $derived(`${name}:${level.level}`);
	let tab = $state<{ at: string; rules: boolean }>({ at: '', rules: false });
	const onRules = $derived(tab.at === at && tab.rules);
	let picked = $state<{ at: string; stat?: string; rule?: string; option?: string } | null>(null);
	const mine = $derived(picked?.at === at ? picked : null);
	const stat = $derived(offer.stats.find((s) => s.stat === mine?.stat && s.blocked === null) ?? null);
	const rule = $derived(offer.rules.flatMap((g) => g.options).find((o) => o.id === mine?.rule && o.blocked === null) ?? null);
	const ready = $derived(onRules ? !!rule && (!rule.weapons || !!rule.weapons.find((w) => w.id === mine?.option)) : !!stat);

	/* A second tap while the write is still running would spend the same level twice. */
	let busy = $state(false);

	async function confirm(pick: LevelPick) {
		if (busy) return;
		busy = true;
		try {
			await onspend(pick);
		} finally {
			busy = false;
		}
	}

	function spend() {
		if (onRules && rule) confirm({ rule: rule.id, ...(mine?.option ? { option: mine.option } : {}) });
		else if (stat) confirm({ stat: stat.stat, bonus: stat.bonus });
	}

	const type = (r: LevelRule) => (r.type ? r.type[0].toUpperCase() + r.type.slice(1) : '');

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}
</script>

<div class="sheet-backdrop">
	<div class="bottom-sheet renown" role="dialog" aria-modal="true" aria-labelledby="renown-title">
		<h2 id="renown-title">{name}</h2>
		<p class="count">{label} {level.level}{#if waiting > 0}{' '}· {waiting} more waiting{/if}</p>
		<p class="notice">{level.note}</p>

		{#if offer.rules.length}
			<div class="tabs mt-3 grid grid-cols-2 gap-2" role="group" aria-label="What to spend the level on">
				<button type="button" class="choice text-center" aria-pressed={!onRules} onclick={() => (tab = { at, rules: false })}>Characteristics</button>
				<button type="button" class="choice text-center" aria-pressed={onRules} onclick={() => (tab = { at, rules: true })}>{offer.rulesLabel}</button>
			</div>
		{/if}

		{#if onRules}
			{#each offer.rules as group (group.heading)}
				<p class="field-label mt-4 mb-1">{group.heading}</p>
				<div class="grid gap-2">
					{#each group.options as option (option.id)}
						{@const open = mine?.rule === option.id}
						<button
							type="button"
							class="choice"
							aria-pressed={open}
							disabled={option.blocked !== null}
							onclick={() => (picked = { at, rule: option.id })}
						>
							<span class="block font-semibold"
								>{option.name}{#if option.type}<span class="font-normal text-zinc-400">{' · '}{type(option)}</span>{/if}</span
							>
							{#if option.blocked}<span class="block text-zinc-400">{option.blocked}</span>{/if}
							{#if open}<span class="mt-1 block"><RichText text={option.text} /></span>{/if}
						</button>
						{#if open && option.weapons}
							<div class="ml-4 grid gap-2" role="group" aria-label="Weapon for {option.name}">
								{#each option.weapons as weapon (weapon.id)}
									<button
										type="button"
										class="choice"
										aria-pressed={mine?.option === weapon.id}
										onclick={() => (picked = { at, rule: option.id, option: weapon.id })}>{weapon.name}</button
									>
								{:else}
									<p class="text-zinc-400">No weapon of this kind to take it for.</p>
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			{/each}
		{:else}
			<div class="mt-3 grid gap-2">
				{#each offer.stats as option (option.stat)}
					<button
						type="button"
						class="choice"
						aria-pressed={mine?.stat === option.stat}
						disabled={option.blocked !== null}
						onclick={() => (picked = { at, stat: option.stat })}
					>
						<span class="flex justify-between gap-3">
							<span class="font-semibold">{option.label}</span>
							<span class="tabular-nums">{option.blocked ? option.from : `${option.from} → ${option.to}`}</span>
						</span>
						{#if option.blocked}<span class="block text-zinc-400">{option.blocked}</span>{/if}
					</button>
				{/each}
			</div>
			{#if !anyStat && anyRule}
				<p class="notice mt-3">No characteristic can be raised – choose under {offer.rulesLabel}.</p>
			{/if}
		{/if}

		<div class="sheet-actions">
			<button type="button" class="btn" onclick={onclose} use:focusOnMount>Decide later</button>
			{#if anyStat || anyRule}
				<button
					type="button"
					class="min-h-11 flex-1 rounded bg-[#125E3C] px-4 font-semibold text-white transition enabled:hover:bg-[#16754A] focus-visible:bg-[#16754A] disabled:opacity-50"
					disabled={!ready || busy}
					onclick={spend}
				>
					{#if onRules && rule}Take {rule.name}{:else if !onRules && stat}Raise {stat.label} to {stat.to}{:else}Choose one{/if}
				</button>
			{:else}
				<button type="button" class="btn" disabled={busy} onclick={() => confirm(null)}>Use up this level</button>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Tall with a hero's talents: the sheet scrolls rather than the page behind it. */
	.renown {
		max-height: calc(100dvh - 24px - env(safe-area-inset-bottom));
		overflow-y: auto;
	}
</style>
