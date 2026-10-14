<script lang="ts" module>
	/** What a level is spent on: a characteristic, a rule with the weapon it was taken for, or nothing where nothing is left. */
	export type LevelPick = { stat: string; bonus: number } | { rule: string; option?: string } | null;
</script>

<script lang="ts">
	import LevelPicker from '$lib/components/LevelPicker.svelte';
	import type { LevelOffer, OpenLevel } from '$lib/core/types';

	/*
	 * A level of a fighter's to spend, as the Wyrdcry Warband Deck asks it after
	 * a battle: a characteristic, or for a hero a heroic talent, each with the
	 * reason where it cannot be taken. The sheet is the back of the fighter's
	 * card, set as its back sets a level to spend; a talent is picked in the box
	 * it opens into, a characteristic at the foot. Spending writes at once;
	 * Decide later keeps the level open for the Battle menu.
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
	let picked = $state<{ at: string; stat: string } | null>(null);
	const stat = $derived(offer.stats.find((s) => s.stat === (picked?.at === at ? picked.stat : null) && s.blocked === null) ?? null);

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

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}
</script>

<div class="sheet-backdrop">
	<div class="card back sheet" role="dialog" aria-modal="true" aria-labelledby="renown-title">
		<div class="scroll">
			<h2 class="name" id="renown-title">{name}</h2>
			<p class="page-count">{label} {level.level}{#if waiting > 0}{' '}· {waiting} more waiting{/if}</p>
			<div class="parchment">
				<section>
					<p class="note">{level.note}</p>

					{#if offer.rules.length}
						<div class="tabs" role="group" aria-label="What to spend the level on">
							<button aria-pressed={!onRules} class:on={!onRules} onclick={() => (tab = { at, rules: false })}>Characteristics</button>
							<button aria-pressed={onRules} class:on={onRules} onclick={() => (tab = { at, rules: true })}>{offer.rulesLabel}</button>
						</div>
					{/if}

					{#if onRules}
						{#key at}
							<LevelPicker {offer} onpick={confirm} />
						{/key}
					{:else}
						<div class="options">
							{#each offer.stats as option (option.stat)}
								<button
									class="option"
									aria-pressed={stat?.stat === option.stat}
									disabled={option.blocked !== null}
									onclick={() => (picked = { at, stat: option.stat })}
								>
									<span class="line">
										{option.label}
										{#if option.blocked}<span class="why">{option.blocked}</span>{/if}
									</span>
									<span class="change">{option.blocked ? option.from : `${option.from} → ${option.to}`}</span>
								</button>
							{/each}
						</div>
						{#if !anyStat && anyRule}
							<p class="note">No characteristic can be raised – choose under {offer.rulesLabel}.</p>
						{/if}
					{/if}
				</section>
			</div>
		</div>

		<div class="foot">
			<button class="plain" onclick={onclose} use:focusOnMount>Decide later</button>
			{#if !anyStat && !anyRule}
				<button class="add" disabled={busy} onclick={() => confirm(null)}>Use up this level</button>
			{:else if !onRules && anyStat}
				<button class="add" disabled={!stat || busy} onclick={() => stat && confirm({ stat: stat.stat, bonus: stat.bonus })}>
					{stat ? `Raise ${stat.label} to ${stat.to}` : 'Choose one'}
				</button>
			{/if}
		</div>
	</div>
</div>
