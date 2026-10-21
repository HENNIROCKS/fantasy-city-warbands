<script lang="ts">
	import RuleText from '$lib/components/RuleText.svelte';
	import type { LevelOffer } from '$lib/core/types';

	/*
	 * What a level can be spent on besides a characteristic, on the back of a
	 * fighter's card, as the Warband Deck's TalentPicker has it there: a pill per
	 * rule that opens into a box with its text, the weapon it is taken for and
	 * the button that picks it.
	 */
	let {
		offer,
		onpick
	}: {
		offer: LevelOffer;
		onpick: (pick: { rule: string; option?: string }) => void;
	} = $props();

	let chosen = $state<string | null>(null);
	let weaponId = $state<string | null>(null);

	const selected = $derived(offer.rules.flatMap((g) => g.options).find((o) => o.id === chosen && o.blocked === null) ?? null);
	const weapon = $derived(selected?.weapons?.find((w) => w.id === weaponId) ?? null);
	const ready = $derived(selected !== null && (selected.weapons === null || weapon !== null));

	function select(id: string) {
		chosen = chosen === id ? null : id;
		weaponId = null;
	}

	function confirm() {
		if (!selected || !ready) return;
		onpick({ rule: selected.id, ...(weapon ? { option: weapon.id } : {}) });
	}
</script>

<div class="picker">
	{#if offer.rulesNote}<p class="hint">{offer.rulesNote}</p>{/if}
	{#each offer.rules as group (group.heading)}
		<h4 class="group">{group.heading}</h4>
		{#each group.options as option (option.id)}
			{@const open = selected?.id === option.id}
			<div class="unfold" class:open>
				<button class="unfold-head" aria-expanded={open} disabled={option.blocked !== null} onclick={() => select(option.id)}>
					<span class="line">
						{option.name}
						{#if option.blocked}<span class="why">{option.blocked}</span>{/if}
					</span>
					{#if option.type}<span class="kind">{option.type}</span>{/if}
				</button>
				{#if open}
					<div class="unfold-detail">
						<p class="unfold-text"><RuleText text={option.text} /></p>
						{#if option.weapons}
							<div class="weapons" role="group" aria-label="Weapon">
								{#each option.weapons as w (w.id)}
									<button class="weapon" class:on={weaponId === w.id} aria-pressed={weaponId === w.id} onclick={() => (weaponId = w.id)}>
										{w.name}
									</button>
								{:else}
									<p class="why">No weapon of this kind to select.</p>
								{/each}
							</div>
						{/if}
						<button class="confirm" disabled={!ready} onclick={confirm}>Pick {option.name}</button>
					</div>
				{/if}
			</div>
		{/each}
	{/each}
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-family: 'Alegreya', serif;
	}

	.group {
		margin: 6px 0 0;
		font-size: calc(18 * var(--t));
		font-weight: 600;
		color: var(--card-ink-muted);
		text-transform: capitalize;
	}

	.weapon,
	.confirm {
		min-height: 44px;
		padding: 8px 14px;
		border: 1px solid var(--card-green);
		border-radius: var(--card-button-radius);
		background: var(--card-field);
		color: var(--card-ink);
		font: inherit;
		font-size: calc(18 * var(--t));
		text-align: left;
	}

	.weapon.on {
		box-shadow: inset 0 0 0 1px var(--card-green);
	}

	.kind {
		flex: none;
		font-size: calc(18 * var(--t));
		color: var(--card-green);
		text-transform: capitalize;
	}

	.unfold-head:disabled .kind {
		color: inherit;
	}

	.why {
		display: block;
		margin: 0;
		font-size: calc(18 * var(--t));
		color: var(--card-ink);
	}

	.weapons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.confirm {
		text-align: center;
		background: var(--card-green);
		color: var(--card-paper);
	}

	.confirm:disabled {
		background: var(--card-field);
		color: var(--card-ink-muted);
	}
</style>
