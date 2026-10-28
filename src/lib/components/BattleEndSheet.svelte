<script lang="ts">
	import BattleResult from '$lib/components/BattleResult.svelte';
	import type { BattleEnd } from '$lib/core/history';

	/*
	 * Ending a battle where the game has no aftermath: the result and the line
	 * in the battle history on one page, set as the aftermath's first page is.
	 * The sheet is the question too – Keep playing goes back to the battle,
	 * End battle writes the line and drops the battle.
	 */
	let {
		round,
		out,
		end = $bindable(),
		onapply,
		onclose
	}: {
		round: number;
		/** How many were out of action when it was asked, as the bar counted them. */
		out: number;
		end: BattleEnd;
		onapply: () => void | Promise<void>;
		onclose: () => void;
	} = $props();

	/* A second tap while the write is still running would write the battle twice. */
	let busy = $state(false);

	async function apply() {
		if (busy) return;
		busy = true;
		try {
			await onapply();
		} finally {
			busy = false;
		}
	}

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}
</script>

<div class="sheet-backdrop">
	<div class="card back sheet" role="dialog" aria-modal="true" aria-labelledby="battle-end-title">
		<div class="scroll">
			<h2 class="name" id="battle-end-title">End the battle</h2>
			<p class="page-count">Round {round}{#if out > 0}{' '}· {out} out of action{/if}</p>
			<div class="parchment">
				<BattleResult bind:end />
			</div>
		</div>

		<div class="foot">
			<button class="plain" onclick={onclose} use:focusOnMount>Keep playing</button>
			<button class="add" disabled={!end.result || busy} onclick={apply}>{end.result ? 'End battle' : 'Pick the result'}</button>
		</div>
	</div>
</div>
