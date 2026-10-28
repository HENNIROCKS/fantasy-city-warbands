<script lang="ts">
	import type { Snippet } from 'svelte';
	import { RESULT_LABELS, displayDate, opponent, type BattleEnd } from '$lib/core/history';
	import type { BattleRecord } from '$lib/core/types';

	/*
	 * The result and the line in the battle history, as every game asks them
	 * when a battle ends: the first page of the aftermath, or the whole of it
	 * where a game has none. What the game adds to the result, such as the
	 * underdog's bonus, stands under the three.
	 */
	let { end = $bindable(), children }: { end: BattleEnd; children?: Snippet } = $props();

	/* A tap picks the result; a tap on the picked one takes it back. */
	function pick(result: BattleRecord['result']) {
		end.result = end.result === result ? null : result;
	}
</script>

<section>
	<h3 class="heading"><span id="battle-result">Result</span><span class="rule"></span></h3>
	<div class="results" role="group" aria-labelledby="battle-result">
		{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
			<button class="segment" aria-pressed={end.result === key} onclick={() => pick(key as BattleRecord['result'])}>{label}</button>
		{/each}
	</div>
	{@render children?.()}
</section>

<section>
	<h3 class="heading"><span>Battle history</span><span class="rule"></span></h3>
	<button class="switch-row" role="switch" aria-checked={end.record} disabled={!end.result} onclick={() => (end.record = !end.record)}>
		Add to the battle history<span class="track" aria-hidden="true"></span>
	</button>
	{#if end.recorded}
		{@const r = end.recorded}
		<p class="note">Already in the history: {displayDate(r.date)} {opponent(r)} – {RESULT_LABELS[r.result]}</p>
	{/if}
	{#if end.result && end.record}
		<input class="field" type="text" placeholder="Opponent's warband" aria-label="Opponent's warband" autocomplete="off" bind:value={end.opponentWarband} />
		<input class="field" type="text" placeholder="Opponent's name" aria-label="Opponent's name" autocomplete="off" bind:value={end.opponentPlayer} />
	{/if}
</section>

<style>
	/* The result as one pill of three across the card, as on the back of the warband card. */
	.results .segment {
		flex: 1;
	}
</style>
