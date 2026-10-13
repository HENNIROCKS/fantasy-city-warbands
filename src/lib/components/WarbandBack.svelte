<script lang="ts">
	import { RESULT_LABELS, displayDate, newestFirst, opponent } from '$lib/core/history';
	import { goldIn, saleOf, toRecord, type WarbandBackDraft } from '$lib/core/stash';
	import type { BattleRecord, Faction, GameSystem, Warband } from '$lib/core/types';
	import { purse, warbandCost } from '$lib/core/validate';

	/*
	 * The back of the warband card, turned over to be written on, as the Wyrdcry
	 * Warband Deck has it: the gold and what lies in the stash, then the battles.
	 * Name, colour, favour, fluff and notes stay in the builder's finish step.
	 */
	let {
		name,
		warband,
		faction,
		game,
		draft = $bindable()
	}: {
		name: string;
		warband: Warband;
		faction: Faction;
		game: GameSystem;
		draft: WarbandBackDraft;
	} = $props();

	const stash = $derived(warband.stash ?? []);
	const left = $derived(purse(warband, game) - warbandCost(warband, faction));
	const gained = $derived(goldIn(stash, draft, faction, game));

	/* Gold typed in, added to the draft with Add. */
	let goldInput = $state('');

	function addGold() {
		const amount = Math.floor(Number(goldInput));
		if (!(amount > 0)) return;
		draft.goldAdded = [...draft.goldAdded, amount];
		goldInput = '';
	}

	function stashOut(index: number, sold: boolean) {
		draft.stashOut = [...draft.stashOut, { index, sold }];
	}

	function stashBack(index: number) {
		draft.stashOut = draft.stashOut.filter((out) => out.index !== index);
	}

	function pick(result: BattleRecord['result']) {
		draft.pending.result = draft.pending.result === result ? null : result;
	}

	function add() {
		const record = toRecord(draft.pending);
		if (!record) return;
		draft.history = [...draft.history, record];
		draft.pending = { ...draft.pending, result: null, opponentWarband: '', opponentPlayer: '' };
	}

	function toggleRemoved(id: string) {
		draft.removed = draft.removed.includes(id) ? draft.removed.filter((r) => r !== id) : [...draft.removed, id];
	}

	const wargearName = (id: string) => faction.wargear.find((w) => w.id === id)?.name ?? id;
</script>

<article class="card back">
	<h2 class="name">{name}</h2>

	<div class="parchment">
		<section>
			<h3 class="heading"><span>Stash</span><span class="rule"></span></h3>
			<p class="caption">Gold</p>
			<p class="line">
				{left + gained}
				{game.currency}
				{#if gained}<span class="why">+{gained} {game.currency} with Done</span>{/if}
			</p>
			<div class="entry-row">
				<input
					class="amount"
					type="number"
					inputmode="numeric"
					min="1"
					placeholder="Gold to add"
					aria-label="Gold to add"
					bind:value={goldInput}
				/>
				<button class="add" disabled={!(Number(goldInput) >= 1)} onclick={addGold}>Add</button>
			</div>
			{#if draft.goldAdded.length}
				<button class="remove self-start" onclick={() => (draft.goldAdded = draft.goldAdded.slice(0, -1))}>
					Undo {draft.goldAdded.at(-1)}
					{game.currency}
				</button>
			{/if}

			<p class="caption">Equipment</p>
			{#if stash.length}
				<ul class="list">
					{#each stash as id, i (i)}
						{@const out = draft.stashOut.find((o) => o.index === i)}
						{@const sale = saleOf(id, faction, game)}
						<li class:gone={out}>
							<span class="line">
								<span class="piece">{wargearName(id)}</span>
								{#if out}<span class="why">{out.sold ? `Sold for ${sale} ${game.currency}` : 'Thrown away'}</span>{/if}
							</span>
							{#if out}
								<button class="remove" onclick={() => stashBack(i)}>Undo</button>
							{:else}
								{#if sale}
									<button class="remove" onclick={() => stashOut(i, true)}>Sell {sale} {game.currency}</button>
								{/if}
								<button class="remove" onclick={() => stashOut(i, false)}>Discard</button>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="hint">The stash is empty.</p>
			{/if}
		</section>

		<section>
			<h3 class="heading"><span>Battles</span><span class="rule"></span></h3>
			<input class="date" type="date" aria-label="Date" bind:value={draft.pending.date} />
			<div class="toggles" role="group" aria-label="Result">
				{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
					<button class="toggle" aria-pressed={draft.pending.result === key} onclick={() => pick(key as BattleRecord['result'])}>
						{label}
					</button>
				{/each}
			</div>
			<input
				type="text"
				placeholder="Opponent's warband"
				aria-label="Opponent's warband"
				autocomplete="off"
				bind:value={draft.pending.opponentWarband}
			/>
			<input
				type="text"
				placeholder="Opponent's name"
				aria-label="Opponent's name"
				autocomplete="off"
				bind:value={draft.pending.opponentPlayer}
			/>
			<button class="add" disabled={!draft.pending.result || !draft.pending.date} onclick={add}>Add battle</button>

			{#if draft.history.length}
				<ul class="list">
					{#each newestFirst(draft.history) as record (record.id)}
						{@const removed = draft.removed.includes(record.id)}
						<li class:removed>
							<span class="line">
								<span class="when">{displayDate(record.date)}</span>
								{opponent(record)} – {RESULT_LABELS[record.result]}
							</span>
							<button class="remove" onclick={() => toggleRemoved(record.id)}>{removed ? 'Keep' : 'Remove'}</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</article>

<style>
	/* A lighter patch of the paper rather than a box, as the fighter's back has
	   its fields: no frame and no line, edged in green while written in. */
	input {
		width: 100%;
		margin: 0;
		padding: calc(6 * var(--u)) calc(10 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		color: var(--card-ink);
		background: var(--card-field);
		border: 0;
		border-radius: calc(6 * var(--u));
		outline: none;
		appearance: none;
	}

	input:focus {
		background: rgb(255 255 255 / 0.7);
		box-shadow: inset 0 0 0 1px var(--card-green);
	}

	::placeholder {
		color: var(--card-ink-muted);
		font-style: italic;
	}

	.entry-row {
		display: flex;
		align-items: flex-end;
		gap: calc(12 * var(--u));
	}

	.date,
	.amount {
		flex: 1;
		min-width: 0;
		font-variant-numeric: lining-nums tabular-nums;
	}

	/* Names a list within a section, set like the counters' labels. */
	.caption {
		margin: calc(6 * var(--u)) 0 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		font-weight: 700;
		color: var(--card-ink);
	}

	.add {
		align-self: flex-end;
		min-height: 40px;
		padding: 0 calc(14 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: 999px;
		background: var(--card-green);
		color: var(--card-paper);
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
	}

	/* Until there is something to add, an unpicked choice, set back. */
	.add:disabled {
		background: var(--card-field);
		color: var(--card-green);
		opacity: 0.5;
	}

	.remove {
		flex: none;
		min-height: 40px;
		padding: 0 calc(6 * var(--u));
		border: 0;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-link);
	}

	/* As on the front: a solid rule above the log, a dashed one under each row. */
	.list {
		margin: calc(6 * var(--u)) 0 0;
		padding: 0;
		list-style: none;
		border-top: 1.5px solid #000;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.3;
	}

	.list li {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--u));
		padding: calc(4 * var(--u)) 0;
		border-bottom: 1px dashed #000;
	}

	.line {
		flex: 1;
		min-width: 0;
		margin: 0;
		overflow-wrap: anywhere;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-ink);
	}

	.when {
		margin-right: 0.3em;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.removed .line,
	.gone .line {
		color: var(--card-ink-muted);
	}

	/* A piece leaving the stash is struck out; what becomes of it is not. */
	.removed .line,
	.gone .piece {
		text-decoration: line-through;
	}

	.why {
		display: block;
		font-size: calc(18 * var(--t));
		font-style: italic;
	}
</style>
