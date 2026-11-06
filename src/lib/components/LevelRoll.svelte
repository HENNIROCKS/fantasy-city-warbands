<script lang="ts">
	import type { LevelOffer } from '$lib/core/types';

	/*
	 * The roll that decides what a level may be spent on, as Black Death City's
	 * advancement roll: a button per result, and under the tapped one what it
	 * allows. Tapping a result again is the page's to read as taking it back.
	 */
	let {
		roll,
		picked,
		onpick
	}: {
		roll: NonNullable<LevelOffer['roll']>;
		/** The result tapped, by its roll; null before the roll is tapped. */
		picked: string | null;
		onpick: (result: string) => void;
	} = $props();

	const result = $derived(roll.results.find((r) => r.roll === picked) ?? null);
</script>

<p class="caption" id="level-roll">{roll.label}</p>
<div class="toggles stacked" role="group" aria-labelledby="level-roll">
	{#each roll.results as option (option.roll)}
		<button class="toggle" aria-pressed={picked === option.roll} onclick={() => onpick(option.roll)}>
			{option.roll} · {option.name}
		</button>
	{/each}
</div>
{#if result}<p class="hint">{result.text}</p>{/if}
