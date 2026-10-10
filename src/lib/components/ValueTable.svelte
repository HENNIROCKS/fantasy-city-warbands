<script lang="ts">
	import type { CardValue } from '$lib/core/card';
	import { fitText } from '$lib/fit-text';

	let { rows }: { rows: CardValue[] } = $props();
</script>

<!-- Each row fits on its own: a long value would otherwise pull the labels down
     with it, and those have room left. A label with a short form gives way to it
     on a narrow card before the row is scaled back. -->
<div class="box">
	<div class="row head" use:fitText>
		{#each rows as row (row.key)}
			<div class="col label">
				{#if row.short}
					<abbr class="long" title={row.label} data-fit>{row.label}</abbr><abbr class="short" title={row.label} data-fit
						>{row.short}</abbr
					>
				{:else}
					<span data-fit>{row.label}</span>
				{/if}
			</div>
		{/each}
	</div>
	<div class="row values" use:fitText>
		{#each rows as row (row.key)}
			<div class="col value"><span data-fit>{row.value}</span></div>
		{/each}
	</div>
</div>

<style>
	.box {
		border: 1px solid var(--card-green);
		border-radius: calc(7.5 * var(--u));
		overflow: hidden;
	}

	.row {
		display: flex;
		height: calc(46 * var(--u));
	}

	.head {
		background: var(--card-green);
	}

	.values {
		background: var(--card-wash);
	}

	.col {
		flex: 1 1 0;
		/* Equal columns: without this a label that does not wrap widens its own
		   column at the cost of the others. */
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		line-height: 1.15;
		text-align: center;
		/* Grenze Gotisch defaults to old-style figures, which reach 77% of the cap
		   height the column labels are set in and hang below the baseline. The
		   lining set matches the labels; the tabular one keeps the digits of a
		   column over each other. */
		font-variant-numeric: lining-nums tabular-nums;
	}

	/*
	 * Two layers of the same word, as on the printed card: the cell cuts it out of
	 * the texture, the span paints it again in solid paper. What shows is the
	 * paper, a touch heavier for the textured edge underneath it.
	 *
	 * Past the floor the fit action stops at, a label would run into the next
	 * column – it is cut there instead.
	 */
	.label {
		font-size: calc(20 * var(--t) * var(--fit, 1));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		background: var(--card-texture) center center / cover no-repeat;
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	.label > * {
		color: var(--card-paper);
		text-decoration: none;
	}

	.short {
		display: none;
	}

	@container (max-width: 420px) {
		.long {
			display: none;
		}

		.short {
			display: inline;
		}
	}

	/* Past the floor the fit action stops at, a value is cut rather than run
	   into the next column. */
	.value {
		color: var(--card-ink);
		font-size: calc(20 * var(--t) * var(--fit, 1));
		white-space: nowrap;
		overflow: hidden;
		padding: 0 calc(4 * var(--u));
	}
</style>
