<script lang="ts">
	import type { FighterBattleState } from '$lib/core/battle';

	/*
	 * The battle under the thumb, below the deck, as the Wyrdcry Warband Deck
	 * keeps it: a fighter's card counts its damage here and is turned over to be
	 * written on, the warband card counts who is out and ends the battle.
	 */
	let {
		fighter = null,
		health = 0,
		out = 0,
		running = false,
		sound = true,
		onwound,
		onend,
		onsound,
		editing = false,
		onedit,
		ondone,
		oncancel
	}: {
		/** The fighter on top of the stack. Null while the warband card is up. */
		fighter?: FighterBattleState | null;
		/** Health as that fighter's card works it out. */
		health?: number;
		/** How many fighters are out of action. */
		out?: number;
		/** Whether a battle has been started, which the first damage point does. */
		running?: boolean;
		sound?: boolean;
		onwound?: (delta: number) => void;
		onend?: () => void;
		onsound?: () => void;
		/** Whether the card on top is turned over to be written on. */
		editing?: boolean;
		/** Turns the fighter's card on top over. */
		onedit?: () => void;
		ondone?: () => void;
		oncancel?: () => void;
	} = $props();

	/* What is left of Health, which is what the stepper counts. A fighter whose
	   Health dropped in the builder can stand at none without being out; the next
	   damage point puts it out, so only being out holds the stepper back. */
	const left = $derived(fighter ? Math.max(0, health - fighter.damage) : 0);
	const unknown = $derived(health <= 0);

	/* Ending the battle drops every wound, so it asks once more before it does.
	   The question goes away again when it is not answered, or when a fighter's
	   card comes up in between. */
	let confirming = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function end() {
		clearTimeout(timer);
		if (confirming) {
			confirming = false;
			onend?.();
			return;
		}
		confirming = true;
		timer = setTimeout(() => (confirming = false), 4000);
	}

	$effect(() => {
		if (fighter) {
			clearTimeout(timer);
			confirming = false;
		}
	});

	$effect(() => () => clearTimeout(timer));
</script>

<div class="border-t border-zinc-800 bg-zinc-900" style="padding-bottom: env(safe-area-inset-bottom)">
	<div class="bar">
		{#if editing}
			<!-- While a card is turned over the bar only finishes the edit: a wound
			     counted now would land on a card whose front is not in view. -->
			<div class="finish">
				<button class="btn" onclick={() => oncancel?.()}>Cancel</button>
				<button
					class="min-h-11 rounded bg-[#125E3C] px-6 font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
					onclick={() => ondone?.()}>Done</button
				>
			</div>
		{:else if fighter}
			<div class="wounds">
				<button
					class="step border-zinc-700 bg-zinc-800 text-zinc-200 enabled:hover:bg-zinc-700 focus-visible:bg-zinc-700"
					disabled={unknown || fighter.out}
					aria-label="Allocate a damage point"
					onclick={() => onwound?.(1)}
				>
					&minus;
				</button>
				<span class="readout" aria-live="polite">
					{#if unknown}
						&mdash;
					{:else}
						{left} <span class="of text-zinc-400">({health})</span>
					{/if}
				</span>
				<button
					class="step border-zinc-700 bg-zinc-800 text-zinc-200 enabled:hover:bg-zinc-700 focus-visible:bg-zinc-700"
					disabled={unknown || fighter.damage === 0}
					aria-label="Take back a damage point"
					onclick={() => onwound?.(-1)}
				>
					+
				</button>
			</div>
			<button
				class="action edit border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 focus-visible:bg-zinc-700"
				aria-label="Edit"
				onclick={() => onedit?.()}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
			</button>
		{:else}
			<p class="summary text-zinc-400">{running ? `${out} out of action` : 'No battle'}</p>
			<div class="actions">
				<button
					class="action border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 focus-visible:bg-zinc-700"
					aria-pressed={sound}
					aria-label="Sound when a fighter goes out of action"
					onclick={() => onsound?.()}
				>
					{#if sound}
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
					{:else}
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" /><path d="m16 9 6 6M22 9l-6 6" /></svg>
					{/if}
				</button>
				{#if running}
					<button
						class="action border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 focus-visible:bg-zinc-700"
						class:confirming
						onclick={end}
					>
						{confirming ? 'Drop all wounds?' : 'End battle'}
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		/* Held whatever the bar carries, so the deck does not change height when a
		   swipe brings the warband card up. */
		min-height: 52px;
		width: 100%;
		max-width: calc(var(--deck-max-width) + 2 * var(--deck-gutter));
		margin-inline: auto;
		padding: 4px var(--deck-gutter);
	}

	.wounds,
	.actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.finish {
		display: flex;
		gap: 8px;
		width: 100%;
	}

	.finish > * {
		flex: 1;
	}

	.step {
		width: 44px;
		height: 44px;
		padding: 0;
		border-width: 1px;
		border-radius: 6px;
		font-size: 1.5rem;
		line-height: 1;
	}

	.step:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.readout {
		min-width: 5ch;
		text-align: center;
		font-size: 1.25rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* The ceiling, not the reading: it is there to say what the figure counts down
	   from. */
	.of {
		font-weight: 400;
		font-size: 1rem;
	}

	.summary {
		margin: 0;
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}

	.action {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 48px;
		height: 44px;
		padding: 0 12px;
		border-width: 1px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	/* Square, as the steppers it shares the row with. */
	.edit {
		min-width: 44px;
		width: 44px;
		padding: 0;
	}

	.action svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* The one tap that throws something away, asked in the colour for it. */
	.action.confirming {
		border-color: var(--ui-danger);
		background: var(--ui-danger-bg);
		color: var(--ui-danger-text);
	}
</style>
