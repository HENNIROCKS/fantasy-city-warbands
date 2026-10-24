<script lang="ts">
	import MenuButton from '$lib/components/MenuButton.svelte';
	import type { CardItem } from '$lib/core/card';
	import { explain } from '$lib/explanation';
	import { fitText } from '$lib/fit-text';

	/*
	 * What the fighter carries besides its weapons, under them in a box of the
	 * same make, without a head: the names say what they are. A single-use piece
	 * has a row for each copy, and while a battle runs a box beside it ticks it
	 * off – struck, not taken away; the aftermath takes it. One that is used on a
	 * weapon asks which, where the fighter holds more than one.
	 */
	let {
		items,
		onuse,
		onunuse
	}: {
		items: CardItem[];
		/** Given while a battle runs: uses a copy of the piece, on the weapon picked where it picks one. */
		onuse?: (wargear: string, on?: string) => void;
		/** Takes a use back, by its place in the fighter's uses. */
		onunuse?: (at: number) => void;
	} = $props();

	interface Row {
		item: CardItem;
		name: string;
		/** For a copy of a single-use piece: where it is used, the use's place among the fighter's; null where it is not. */
		copy?: { at: number | null };
	}

	const rows = $derived(
		items.flatMap((item): Row[] =>
			item.copies
				? item.copies.map((c) => ({ item, name: c?.on ? `${item.name} (${c.on})` : item.name, copy: { at: c?.at ?? null } }))
				: [{ item, name: item.count > 1 ? `${item.name} ×${item.count}` : item.name }]
		)
	);
</script>

<div class="box">
	{#each rows as row, i (row.item.wargear + i)}
		<div class="row" class:used={row.copy && row.copy.at !== null}>
			<div class="col name" use:fitText>
				{#if row.item.explanation}
					<button class="tagged" onclick={() => row.item.explanation && explain(row.item.explanation)} aria-label="{row.name}, its rules">
						<span data-fit>{row.name}</span>
					</button>
				{:else}
					<span data-fit>{row.name}</span>
				{/if}
			</div>
			{#if onuse && row.copy}
				{@const { item, copy } = row}
				<div class="col use">
					{#if copy.at !== null}
						{@const at = copy.at}
						<button class="tick" role="checkbox" aria-checked="true" aria-label="{row.name} used" onclick={() => onunuse?.(at)}>
							{@render box(true)}
						</button>
					{:else if item.weapons && item.weapons.length > 1}
						{@const weapons = item.weapons}
						<MenuButton label="Use {item.name} on a weapon" class="tick">
							{#snippet trigger()}{@render box(false)}{/snippet}
							<p>{item.name} on:</p>
							{#each weapons as weapon (weapon.id)}
								<button onclick={() => onuse(item.wargear, weapon.id)}>{weapon.name}</button>
							{/each}
						</MenuButton>
					{:else if item.weapons}
						{@const weapon = item.weapons[0]}
						<button
							class="tick"
							role="checkbox"
							aria-checked="false"
							aria-label={weapon ? `Use ${item.name} on ${weapon.name}` : `${item.name}: no weapon to use it on`}
							disabled={!weapon}
							onclick={() => weapon && onuse(item.wargear, weapon.id)}
						>
							{@render box(false)}
						</button>
					{:else}
						<button class="tick" role="checkbox" aria-checked="false" aria-label="Use {item.name}" onclick={() => onuse(item.wargear)}>
							{@render box(false)}
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>

{#snippet box(checked: boolean)}
	<span class="check" class:checked aria-hidden="true">
		{#if checked}<svg viewBox="0 0 12 12"><path d="M2 6.5 5 9.5 10 2.5" /></svg>{/if}
	</span>
{/snippet}

<style>
	.box {
		border: 1px solid var(--card-green);
		border-radius: calc(7.5 * var(--u));
		overflow: hidden;
	}

	.row {
		display: flex;
		min-height: calc(46 * var(--u));
		background: var(--card-wash);
	}

	/* Striped as the weapons are, the first row light. */
	.row:nth-child(even) {
		background: var(--card-wash-2);
	}

	.col {
		display: flex;
		align-items: center;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		line-height: 1.15;
		color: var(--card-ink);
	}

	.col.name {
		flex: 1 1 0;
		min-width: 0;
		overflow: hidden;
		padding: calc(3 * var(--u)) calc(4 * var(--u)) calc(3 * var(--u)) calc(14 * var(--u));
	}

	.col.use {
		flex: 0 0 48px;
	}

	.tagged {
		appearance: none;
		border: 0;
		max-width: 100%;
		padding: 0;
		background: none;
		color: var(--card-link);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.14em;
		cursor: pointer;
	}

	.col.name span {
		font-size: calc(20 * var(--t) * var(--fit, 1));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Used up for the battle: struck through and set back, still on the card until the aftermath takes it. */
	.used .col.name span {
		text-decoration: line-through;
		text-decoration-thickness: 1.5px;
	}

	.used .col.name {
		opacity: 0.6;
	}

	.used .tagged {
		text-decoration: none;
	}

	/* The whole cell answers the tap; the box in it is small. */
	.col.use :global(.tick) {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.col.use :global(.tick:disabled) {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.check {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		box-sizing: border-box;
		border: 1.5px solid var(--card-green);
		border-radius: 3px;
		background: var(--card-field);
	}

	.check.checked {
		background: var(--card-green);
	}

	.check svg {
		width: 12px;
		height: 12px;
		fill: none;
		stroke: var(--card-paper);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
