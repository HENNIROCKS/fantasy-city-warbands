<script lang="ts">
	import MenuButton from '$lib/components/MenuButton.svelte';
	import type { BattleState, FighterBattleState } from '$lib/core/battle';
	import type { FactionCounter } from '$lib/core/types';

	/*
	 * The battle under the thumb, below the deck, as the Wyrdcry Warband Deck
	 * keeps it: a fighter's card counts its damage and its state here and is
	 * turned over to be written on; the warband card says how the round stands
	 * and holds the battle itself – start, next round, end.
	 */
	let {
		battle = null,
		fighter = null,
		health = 0,
		waiting = false,
		marks = [],
		counter,
		stage = null,
		wavering = false,
		toAct = 0,
		out = 0,
		sound = true,
		onwound,
		onactivated,
		onwaiting,
		onmark,
		oncount,
		onstart,
		onnext,
		onundo,
		onend,
		oncancelbattle,
		onsound,
		levelsOpen = 0,
		levelLabel = '',
		onlevels,
		editing = false,
		doneLabel = 'Done',
		doneDisabled = false,
		onedit,
		ondone,
		oncancel
	}: {
		battle?: BattleState | null;
		/** The fighter on top of the stack. Null while the warband card is up. */
		fighter?: FighterBattleState | null;
		/** Health as that fighter's card works it out. */
		health?: number;
		/** Whether the game lets a fighter wait. */
		waiting?: boolean;
		/** The marks the fighter on top can carry, and whether it does. */
		marks?: { key: string; label: string; on: boolean }[];
		/** What the faction counts through the battle; the warband card counts it in place of the round. */
		counter?: FactionCounter;
		/** The highest stage of it reached, by its label. */
		stage?: string | null;
		/** Whether the warband's morale is wavering. */
		wavering?: boolean;
		/** How many fighters still have to act this round. */
		toAct?: number;
		/** How many fighters are out of action. */
		out?: number;
		sound?: boolean;
		onwound?: (delta: number) => void;
		onactivated?: () => void;
		onwaiting?: () => void;
		onmark?: (key: string) => void;
		oncount?: (delta: number) => void;
		onstart?: () => void;
		onnext?: () => void;
		onundo?: () => void;
		/** Ends the battle: asks the aftermath where the game has one, else whether to drop it. */
		onend?: () => void;
		/** Drops the battle without its aftermath, after asking. Only where the game has an aftermath. */
		oncancelbattle?: () => void;
		onsound?: () => void;
		/** How many of the fighters' levels are open, and what a level is called: `Renown`. */
		levelsOpen?: number;
		levelLabel?: string;
		/** Opens the sheet that spends them. */
		onlevels?: () => void;
		/** Whether the card on top is turned over to be written on. */
		editing?: boolean;
		/** What finishing the turned card does, on its button. */
		doneLabel?: string;
		/** Holds the button back while the turned card still lacks an answer. */
		doneDisabled?: boolean;
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

	const BUTTON = 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 focus-visible:bg-zinc-700';
</script>

<div class="border-t border-zinc-800 bg-zinc-900" style="padding-bottom: env(safe-area-inset-bottom)">
	<div class="bar">
		{#if editing}
			<!-- While a card is turned over the bar only finishes the edit: a state
			     changed now would land on a card whose front is not in view. -->
			<div class="finish">
				<button class="btn" onclick={() => oncancel?.()}>Cancel</button>
				<button
					class="min-h-11 rounded bg-[#125E3C] px-6 font-semibold text-white transition enabled:hover:bg-[#16754A] focus-visible:bg-[#16754A] disabled:opacity-50"
					disabled={doneDisabled}
					onclick={() => ondone?.()}>{doneLabel}</button
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
			<div class="actions">
				<!-- A word rather than a symbol, as the entries behind it are words. No
				     mark on the trigger: the card above names every state it holds. -->
				<MenuButton label="Fighter state" class="action {BUTTON}">
					{#snippet trigger()}State{/snippet}
					<button aria-pressed={fighter.activated} onclick={() => onactivated?.()}>
						<span class="tick" aria-hidden="true">{fighter.activated ? '✓' : ''}</span>Activated
					</button>
					{#if waiting}
						<button aria-pressed={fighter.waiting} onclick={() => onwaiting?.()}>
							<span class="tick" aria-hidden="true">{fighter.waiting ? '✓' : ''}</span>Waiting
						</button>
					{/if}
					{#each marks as mark (mark.key)}
						<button aria-pressed={mark.on} onclick={() => onmark?.(mark.key)}>
							<span class="tick" aria-hidden="true">{mark.on ? '✓' : ''}</span>{mark.label}
						</button>
					{/each}
				</MenuButton>
				<button class="action edit {BUTTON}" aria-label="Edit" onclick={() => onedit?.()}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
				</button>
			</div>
		{:else}
			{#if counter}
				<!-- A faction that counts through the battle has the count where a
				     fighter has its wounds, under the same thumb; the round is in the
				     battle menu. -->
				<div class="wounds">
					<button
						class="step border-zinc-700 bg-zinc-800 text-zinc-200 enabled:hover:bg-zinc-700 focus-visible:bg-zinc-700"
						disabled={!battle || battle.counter === 0}
						aria-label="Take back a point of {counter.label}"
						onclick={() => oncount?.(-1)}
					>
						&minus;
					</button>
					<span class="readout wide" aria-live="polite">
						<span class="of text-zinc-400">{counter.label}</span> {battle?.counter ?? 0}
					</span>
					<button
						class="step border-zinc-700 bg-zinc-800 text-zinc-200 enabled:hover:bg-zinc-700 focus-visible:bg-zinc-700"
						aria-label="Count a point of {counter.label}"
						onclick={() => oncount?.(1)}
					>
						+
					</button>
					<span class="stage" aria-live="polite">{battle ? (stage ?? '') : ''}</span>
				</div>
			{:else}
				<p class="summary text-zinc-400" aria-live="polite">
					{@render standing()}
				</p>
			{/if}
			<div class="actions">
				<!-- Where the count takes the standing line's place, the menu's trigger
				     carries the morale instead, so it shows under the warband card too. -->
				<MenuButton
					label={counter && wavering ? 'Battle, wavering' : 'Battle'}
					class="action {BUTTON} {counter && wavering ? 'warn' : ''}"
				>
					{#snippet trigger()}Battle{/snippet}
					{#if counter}
						<p>{@render standing()}</p>
					{/if}
					{#if battle}
						<button onclick={() => onnext?.()}>Next round</button>
						{#if battle.undo}
							<button onclick={() => onundo?.()}>Back to round {battle.undo.round}</button>
						{/if}
					{:else}
						<button onclick={() => onstart?.()}>Start battle</button>
					{/if}
					{#if levelsOpen > 0}
						<hr />
						<button onclick={() => onlevels?.()}>Spend {levelLabel.toLowerCase()} ({levelsOpen})</button>
					{/if}
					<hr />
					<button aria-pressed={sound} onclick={() => onsound?.()}>
						<span class="tick" aria-hidden="true">{sound ? '✓' : ''}</span>Scream when out of action
					</button>
					{#if battle}
						<hr />
						<button onclick={() => onend?.()}>End battle…</button>
						{#if oncancelbattle}
							<button onclick={() => oncancelbattle?.()}>Cancel battle…</button>
						{/if}
					{/if}
				</MenuButton>
			</div>
		{/if}
	</div>
</div>

{#snippet standing()}
	{#if battle}
		Round {battle.round} · {toAct} to act{#if out > 0}{' '}· {out} out{/if}{#if wavering}{' '}·
			<span class="wavering">Wavering</span>{/if}
	{:else}
		No battle
	{/if}
{/snippet}

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

	.bar :global(.action) {
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
	.action.edit {
		min-width: 44px;
		width: 44px;
		padding: 0;
	}

	.bar :global(.action svg) {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* Wide enough for two digits, so the + under the thumb stays where it is. */
	.readout.wide {
		min-width: 7ch;
	}

	.stage {
		font-size: 0.875rem;
		font-weight: 600;
	}

	/* The one state of the warband that asks something of every fighter: in the
	   colour for what needs doing. */
	.wavering {
		font-weight: 600;
		color: var(--ui-warn-text);
	}

	.bar :global(.action.warn) {
		border-color: var(--ui-warn-border);
		color: var(--ui-warn-text);
	}

	/* Holds the column the entries line up in, whether an entry is ticked or not. */
	.tick {
		display: inline-block;
		width: 1.4em;
	}
</style>
