<script lang="ts">
	import type { CardWeapon } from '$lib/core/card';
	import { explain } from '$lib/explanation';
	import { fitText } from '$lib/fit-text';

	let { weapons, columns }: { weapons: CardWeapon[]; columns: string[] } = $props();
</script>

<div class="box">
	<!-- Fitted as one row, so five columns of a game such as Black Death City
	     keep their labels at one size on a narrow card. -->
	<div class="row head" use:fitText>
		<div class="col name"><span data-fit>{weapons.length > 1 ? 'Weapons' : 'Weapon'}</span></div>
		{#each columns as column (column)}
			<div class="col"><span data-fit>{column}</span></div>
		{/each}
	</div>
	{#each weapons as weapon, i (weapon.name + i)}
		<div class="row">
			{#if weapon.explanation}
				<div class="col name" use:fitText>
					<button
						class="tagged"
						onclick={() => weapon.explanation && explain(weapon.explanation)}
						aria-label="{weapon.name}, its rules"
					>
						<span data-fit>{weapon.name}</span>
					</button>
				</div>
			{:else}
				<div class="col name" use:fitText><span data-fit>{weapon.name}</span></div>
			{/if}
			{#each weapon.values as value, v (v)}
				<div class="col">{value}</div>
			{/each}
		</div>
	{/each}
</div>

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

	/* Zebra striping skips the header – class plus pseudo-class would otherwise
	   outweigh .head and wash its green out. */
	.row:not(.head):nth-child(odd) {
		background: var(--card-wash-2);
	}

	.head {
		background: var(--card-green);
	}

	.col {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		line-height: 1.15;
		text-align: center;
		color: var(--card-ink);
		/* Grenze Gotisch defaults to old-style figures, which reach 77% of the cap
		   height the headers are set in and hang below the baseline. The lining set
		   matches the headers; the tabular one keeps the digits of a column over
		   each other. */
		font-variant-numeric: lining-nums tabular-nums;
		padding: calc(3 * var(--u)) calc(4 * var(--u));
	}

	.head .col {
		color: var(--card-paper);
	}

	.head .col span {
		font-size: calc(20 * var(--t) * var(--fit, 1));
		white-space: nowrap;
	}

	.col.name {
		flex: 2 2 0;
		overflow: hidden;
	}

	/* The weapon carries rules the card does not print; the link says so and opens
	   them. */
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

	/* A name long enough to leave the cell is set smaller rather than wrapped, down
	   to the floor the action carries – past that it is cut. */
	.col.name span {
		font-size: calc(20 * var(--t) * var(--fit, 1));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
