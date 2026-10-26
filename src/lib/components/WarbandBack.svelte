<script lang="ts">
	import { grow } from '$lib/grow';
	import { DEFAULT_COLOUR, PALETTE, readColour, readable } from '$lib/colour';
	import { RESULT_LABELS, displayDate, newestFirst, opponent } from '$lib/core/history';
	import { findsOf } from '$lib/core/finds';
	import { goldIn, saleOf, toRecord, type WarbandBackDraft } from '$lib/core/stash';
	import { fighterName } from '$lib/core/warband';
	import type { BattleRecord, Faction, GameSystem, Warband } from '$lib/core/types';
	import { purse, warbandCost } from '$lib/core/validate';

	/*
	 * The back of the warband card, turned over to be written on, in the order
	 * of the fighter's back: the name, the fluff and the campaign counters, the
	 * gold and what lies in the stash, the battles, the notes, and last the
	 * colour of the deck, which the deck takes on as it is picked. Stash,
	 * battles and colour are as the Wyrdcry Warband Deck has them there; the
	 * builder's finish step writes the same fields.
	 */
	let {
		name,
		warband,
		faction,
		game,
		blocked,
		draft = $bindable()
	}: {
		name: string;
		warband: Warband;
		faction: Faction;
		game: GameSystem;
		/** Why nothing leaves the stash now, such as a battle going on; null where it can. */
		blocked: string | null;
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

	/* A unique piece taken from the opponent, such as a magic item: one the warband holds already is not offered again. */
	let taking = $state(false);
	const offered = $derived.by(() => {
		if (!game.uniqueName) return [];
		const gone = new Set(draft.stashOut.map((out) => out.index));
		const held = [
			...warband.fighters.filter((f) => f.away !== 'dead').flatMap((f) => f.wargear),
			...stash.filter((_, i) => !gone.has(i)),
			...draft.stashIn
		];
		return faction.wargear.filter((w) => w.unique && !held.includes(w.id));
	});

	function take(id: string) {
		draft.stashIn = [...draft.stashIn, id];
		taking = false;
	}

	/* The warband's counters, and under them what the warband card works out from them, on the counters as the draft leaves them. */
	const counters = $derived(game.campaign?.warband ?? []);
	const worked = $derived.by(() => {
		const own = new Set(counters.map((c) => c.key));
		return (game.campaign?.values?.({ ...warband, tally: draft.tally, stash: [...stash, ...draft.stashIn] }) ?? []).filter((v) => !own.has(v.key));
	});

	function step(key: string, by: number) {
		draft.tally = { ...draft.tally, [key]: Math.max(0, (draft.tally[key] ?? 0) + by) };
	}

	/* Who searched since the battle, to free again where a tap was a mistake. */
	const searched = $derived(
		(findsOf(warband)?.searched ?? []).map((id) => {
			const instance = warband.fighters.find((f) => f.instanceId === id);
			return instance ? fighterName(instance, faction) : 'a fighter no longer here';
		})
	);

	const custom = $derived(draft.colour !== null && !PALETTE.some((entry) => entry.value === draft.colour));
</script>

<article class="card back">
	<h2 class="name">{name}</h2>

	<div class="parchment">
		<section>
			<label class="heading" for="warband-back-name"><span>Name</span><span class="rule"></span></label>
			<input
				id="warband-back-name"
				class="field"
				type="text"
				autocomplete="off"
				placeholder={faction.name}
				bind:value={draft.name}
			/>
		</section>

		<section>
			<label class="heading" for="warband-back-fluff"><span>Fluff</span><span class="rule"></span></label>
			<textarea id="warband-back-fluff" class="field fluff" rows="2" placeholder="A line or two of story" bind:value={draft.fluff} use:grow
			></textarea>
		</section>

		{#if counters.length}
			<!-- As in the builder's finish step, for what the aftermath did not count. -->
			<section>
				<h3 class="heading"><span>Campaign</span><span class="rule"></span></h3>
				{#each counters as counter (counter.key)}
					{@const value = draft.tally[counter.key] ?? 0}
					<div class="counter">
						<span class="label" id="warband-back-{counter.key}">{counter.label}</span>
						<div class="stepper" role="group" aria-labelledby="warband-back-{counter.key}">
							<button class="segment" aria-label="Less {counter.label.toLowerCase()}" disabled={value <= 0} onclick={() => step(counter.key, -1)}
								>−</button
							>
							<output class="figure">{value}</output>
							<button class="segment" aria-label="More {counter.label.toLowerCase()}" onclick={() => step(counter.key, 1)}>+</button>
						</div>
					</div>
				{/each}
				{#if worked.length}
					<p class="line">{worked.map((v) => `${v.label} ${v.value}`).join(' · ')}</p>
				{/if}
				<!-- A tap made by mistake, taken back with Done, as a piece leaves the stash. -->
				{#if searched.length || warband.disbanded}
					<ul class="list">
						{#if searched.length}
							<li class:gone={draft.clearSearches}>
								<span class="line">
									<span class="piece">Searched since the last battle: {searched.join(', ')}</span>
									{#if draft.clearSearches}<span class="why">Free again with Done, what was not bought lost</span>{/if}
								</span>
								<button class="remove" onclick={() => (draft.clearSearches = !draft.clearSearches)}>{draft.clearSearches ? 'Undo' : 'Clear'}</button>
							</li>
						{/if}
						{#if warband.disbanded}
							<li class:gone={draft.undisband}>
								<span class="line">
									<span class="piece">Disbanded – no {game.succession?.keyword.toUpperCase()} was left to lead it</span>
									{#if draft.undisband}<span class="why">Building again with Done – recruit a {game.succession?.keyword.toUpperCase()} to take the lead</span>{/if}
								</span>
								<button class="remove" onclick={() => (draft.undisband = !draft.undisband)}>{draft.undisband ? 'Keep' : 'Undo'}</button>
							</li>
						{/if}
					</ul>
				{/if}
			</section>
		{/if}

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
					class="field amount"
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
			{#if stash.length || draft.stashIn.length}
				{#if blocked}<p class="hint">{blocked}</p>{/if}
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
							{:else if !blocked}
								{#if sale}
									<button class="remove" onclick={() => stashOut(i, true)}>Sell {sale} {game.currency}</button>
								{/if}
								<button class="remove" onclick={() => stashOut(i, false)}>Discard</button>
							{/if}
						</li>
					{/each}
					{#each draft.stashIn as id, i (i)}
						<li>
							<span class="line">
								<span class="piece">{wargearName(id)}</span>
								<span class="why">Taken</span>
							</span>
							<button class="remove" onclick={() => (draft.stashIn = draft.stashIn.filter((_, j) => j !== i))}>Undo</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="hint">The stash is empty.</p>
			{/if}
			{#if offered.length && !blocked}
				<button class="remove self-start" aria-expanded={taking} onclick={() => (taking = !taking)}>Add a {game.uniqueName}</button>
				{#if taking}
					<ul class="list">
						{#each offered as piece (piece.id)}
							<li>
								<span class="line"><span class="piece">{piece.name}</span></span>
								<button class="remove" onclick={() => take(piece.id)}>Add</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</section>

		<section>
			<h3 class="heading"><span>Battles</span><span class="rule"></span></h3>
			<div class="entry-row">
				<input class="field date" type="date" aria-label="Date" bind:value={draft.pending.date} />
				<div class="results" role="group" aria-label="Result">
					{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
						<button class="segment" aria-pressed={draft.pending.result === key} onclick={() => pick(key as BattleRecord['result'])}>
							{label}
						</button>
					{/each}
				</div>
			</div>
			<input
				class="field"
				type="text"
				placeholder="Opponent's warband"
				aria-label="Opponent's warband"
				autocomplete="off"
				bind:value={draft.pending.opponentWarband}
			/>
			<input
				class="field"
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

		<section>
			<label class="heading" for="warband-back-notes"><span>Notes</span><span class="rule"></span></label>
			<textarea id="warband-back-notes" class="field" rows="2" placeholder="Anything to remember at the table" bind:value={draft.notes} use:grow
			></textarea>
		</section>

		<section>
			<h3 class="heading"><span>Colour</span><span class="rule"></span></h3>
			<div class="swatches" role="group" aria-label="Colour of the cards">
				{#each PALETTE as entry (entry.value)}
					<button
						type="button"
						class="swatch"
						style:--swatch={entry.value}
						aria-label={entry.name}
						aria-pressed={(draft.colour ?? DEFAULT_COLOUR) === entry.value}
						onclick={() => (draft.colour = entry.value === DEFAULT_COLOUR ? null : entry.value)}
					></button>
				{/each}
				<!-- Any colour beyond the palette, through the browser's own picker. -->
				<label class="swatch custom" class:on={custom} style:--swatch={draft.colour}>
					<input
						type="color"
						aria-label="Any colour"
						value={draft.colour ?? DEFAULT_COLOUR}
						oninput={(event) => (draft.colour = readColour(event.currentTarget.value))}
					/>
				</label>
			</div>
			{#if draft.colour && !readable(draft.colour)}
				<p class="callout">White type on this colour is hard to read on the cards.</p>
			{/if}
		</section>
	</div>
</article>

<style>
	.fluff {
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

	/* In a row of its own, at the right edge under the field it adds from. */
	.add {
		align-self: flex-end;
	}

	.when {
		margin-right: 0.3em;
		font-variant-numeric: lining-nums tabular-nums;
	}

	li.removed .line,
	li.gone .line {
		color: var(--card-ink-muted);
	}

	/* A piece leaving the stash is struck out; what becomes of it is not. */
	li.removed .line,
	li.gone .piece {
		text-decoration: line-through;
	}
</style>
