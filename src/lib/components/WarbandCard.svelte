<script lang="ts">
	import bannerMask from '$lib/assets/card/banderole-mask.svg?raw';
	import RuleText from '$lib/components/RuleText.svelte';
	import type { CardEntry, RosterEntry, WarbandCardData } from '$lib/core/card';
	import { fitText } from '$lib/fit-text';

	/*
	 * The warband itself as the first card of the deck, as the Warband Deck lays
	 * it out: the name in a banderole, the fluff, two boxes of figures with the
	 * roster across them, then the stash and the notes.
	 */
	let {
		card,
		onpick,
		edit
	}: {
		card: WarbandCardData;
		onpick?: (instanceId: string) => void;
		/** Where the warband is named, for a warband without a name. */
		edit?: string;
	} = $props();

	/* The torn banner shape of the Card Creator's text card. Inlined as a data URL
	   because a mask cannot point at a Svelte import. */
	const mask = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(bannerMask)}")`;

	let article: HTMLElement | undefined = $state();

	/* Within this card only: the deck draws the card beneath as well. */
	function jump(target: string) {
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		article?.querySelector(`[data-anchor="${target}"]`)?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
	}
</script>

<article class="card" bind:this={article}>
	<div class="image-section">
		<div class="banderole">
			<div class="banderole-bg" style="mask-image: {mask}; -webkit-mask-image: {mask};"></div>
			<div class="banderole-text">
				<h2 class="name">{#if card.unnamed && edit}<a href={edit}>{card.name}</a>{:else}{card.name}{/if}</h2>
				<p class="faction">{card.subtitle}</p>
			</div>
		</div>
	</div>

	<div class="parchment">
		{#if card.fluff}
			<p class="fluff">{card.fluff}</p>
		{/if}

		<div class="profile">
			{#each card.tables as rows, i (i)}
				<dl class="stats">
					{#each rows as row (row.key)}
						<dt>{row.label}</dt>
						<dd use:fitText>
							{#if row.target}
								{@const target = row.target}
								<button class="jump" onclick={() => jump(target)}><span data-fit>{row.value}</span></button>
							{:else}
								<span data-fit>{row.value}</span>
							{/if}
						</dd>
					{/each}
				</dl>
			{/each}

			<div class="roster">
				{#each card.roster as group, i (group.title ?? i)}
					<section class="group">
						{#if group.title}<h3>{group.title}</h3>{/if}
						<ul>
							{#each group.entries as entry (entry.instanceId)}
								<li>{@render pick(entry)}</li>
							{/each}
						</ul>
					</section>
				{:else}
					<p class="none">No fighters yet.</p>
				{/each}
			</div>
		</div>

		{#if card.reminders?.length}
			<section class="reminders">{@render paragraphs(card.reminders)}</section>
		{/if}

		{#if card.stash}
			<section class="stash" data-anchor="stash"><p class="entry"><strong>Stash</strong>: {card.stash}</p></section>
		{/if}

		{#if card.notes}
			<section class="notes">{@render paragraphs([{ label: 'Notes', text: card.notes }])}</section>
		{/if}

		{#if card.battles.length}
			<section class="battles">
				<p class="entry"><strong>Battles</strong>: {card.tally}</p>
				<table>
					<!-- The columns speak for themselves on the card; a screen reader
					     needs them named. -->
					<thead class="visually-hidden">
						<tr>
							<th scope="col">Date</th>
							<th scope="col">Opponent</th>
							<th scope="col">Result</th>
						</tr>
					</thead>
					<tbody>
						{#each card.battles as battle (battle.id)}
							<tr>
								<td class="date">{battle.date}</td>
								<td>{battle.opponent}</td>
								<td class="result">{battle.result}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	</div>
</article>

<!-- The whole entry is the way to the fighter's card, set as it reads rather
     than as a button. -->
{#snippet pick(entry: RosterEntry)}
	<button class="pick" disabled={!onpick} onclick={() => onpick?.(entry.instanceId)}>
		<span class="fighter">{entry.name}</span>
		<span class="type">{[entry.leader && 'Leader', entry.type].filter(Boolean).join(' · ')}</span>
	</button>
{/snippet}

<!-- Written on one line: the paragraphs are pre-wrap, so a line break in the
     template would end up on the card. -->
{#snippet paragraphs(entries: CardEntry[])}
	{#each entries as entry, i (entry.label + i)}
		<p class="entry"><strong>{entry.label}</strong>{#if entry.text}: <RuleText text={entry.text} />{/if}</p>
	{/each}
{/snippet}

<style>
	/* ── Image section ─────────────────────────── */

	/*
	 * The empty field the banderole hangs in, as on the Card Creator's text card,
	 * the banderole 76u down from its top. It stays in the flow, so a name over
	 * more than one line grows the field instead of reaching into the parchment.
	 *
	 * Below it the mask matters: it paints the whole of the background box, which
	 * overhangs the banderole by 50u. Those 50u plus the 30u the stats keep clear
	 * – as much as they keep to the boxes below them – less the 29u the parchment
	 * pads with, make the 51u here.
	 */
	.image-section {
		margin: calc(5 * var(--u)) calc(5 * var(--u)) 0;
		padding: calc(76 * var(--u)) 0 calc(51 * var(--u));
	}

	/* Wider than the card on both sides; the card's overflow cuts the ends off. */
	.banderole {
		position: relative;
		margin: 0 calc(-15 * var(--u));
		padding: calc(4 * var(--u)) calc(50 * var(--u));
	}

	/* Reaches well past the label so the torn edges of the mask land outside it. */
	.banderole-bg {
		position: absolute;
		inset: calc(-50 * var(--u)) 0;
		background: var(--card-green);
		mask-size: 100% 100%;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
	}

	.banderole-text {
		position: relative;
		text-align: center;
		font-family: 'Grenze Gotisch', serif;
		color: var(--card-paper);
	}

	/* Free text from the builder: it wraps rather than being cut, and the
	   banderole grows with it. */
	.name {
		margin: 0;
		font-weight: 600;
		font-size: calc(34 * var(--t));
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	/* `Unnamed warband` leads to where the warband is named. In the banderole's own
	   colour, underlined: the link red would not read on the green. */
	.name a {
		color: inherit;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.14em;
	}

	.faction {
		margin: calc(2 * var(--u)) 0 0;
		font-size: calc(20 * var(--t));
		line-height: 1.2;
	}

	/* ── Parchment section ─────────────────────── */

	.parchment {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: calc(14 * var(--u));
		padding: calc(29 * var(--u)) calc(30 * var(--u)) calc(38 * var(--u));
	}

	/* Two boxes side by side and the roster across both below them, the
	   parchment's gap between them and roughly twice that to the boxes further
	   down. The two are stretched to the taller one. */
	.profile {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: calc(14 * var(--u));
		margin-bottom: calc(16 * var(--u));
	}

	.stats,
	.roster {
		margin: 0;
		padding: calc(14 * var(--u)) calc(16 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: calc(7.5 * var(--u));
		/* The fighter tables' values row: it lifts the green labels to 4.8:1
		   over the texture's mean. */
		background: var(--card-wash);
	}

	/* Labels in a column as wide as the longest, so every value of a box starts
	   on the same edge. On the baseline, so a value set smaller still sits on the
	   line of its label. */
	.stats {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-content: start;
		align-items: baseline;
		column-gap: calc(12 * var(--u));
		row-gap: calc(4 * var(--u));
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		line-height: 1.3;
		/* Grenze Gotisch defaults to old-style figures, which hang below the
		   baseline; the lining set sits on it like the labels, the tabular one
		   keeps the digits of the column over each other. */
		font-variant-numeric: lining-nums tabular-nums;
	}

	.stats dt {
		color: var(--card-green);
	}

	/* Fitted one by one: only a value too long for its box is set smaller. */
	.stats dd {
		min-width: 0;
		margin: 0;
		font-size: calc(20 * var(--t) * var(--fit, 1));
		color: var(--card-ink);
	}

	/* A block, so the fit action can read how wide the value wants to be. Past
	   the floor it stops at, the value is cut rather than run out of its box. */
	.stats dd span {
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* A value that leads to a part of the card further down, set as a link. */
	.jump {
		display: block;
		width: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		color: var(--card-link);
		text-align: left;
	}

	/* The groups one under the other, each across the full width in two
	   columns, as far apart as the box is padded. */
	.roster {
		grid-column: 1 / -1;
		display: grid;
		row-gap: calc(14 * var(--u));
	}

	.group h3 {
		margin: 0 0 calc(4 * var(--u));
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		font-weight: inherit;
		line-height: 1.3;
		color: var(--card-green);
	}

	.group ul {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: calc(16 * var(--u));
		row-gap: calc(6 * var(--u));
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.group li,
	.none {
		min-width: 0;
		margin: 0;
		font-family: 'Alegreya', serif;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.pick {
		display: block;
		width: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		color: inherit;
		text-align: left;
	}

	.fighter {
		display: block;
		font-size: calc(18 * var(--t));
	}

	.type,
	.none {
		display: block;
		font-size: calc(15 * var(--t));
		color: var(--card-ink-muted);
	}

	/* Prose, not a rule: no wash, no border, set apart only by the italic. Twice
	   the parchment's own gap below it, so it reads as its own beat rather than
	   running into what follows. */
	.fluff {
		margin: 0 0 calc(14 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		font-style: italic;
		white-space: pre-wrap;
	}

	/* The notes carry their own line breaks and dashed lists. */
	.entry {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		white-space: pre-wrap;
	}

	.entry + .entry {
		margin-top: 1em;
	}

	/* The boxes' light wash sets the notes off from the paper, so they need no
	   rule of their own; what the battle brings and the stash are set as they are. */
	.reminders,
	.stash,
	.notes {
		padding: calc(14 * var(--u)) calc(16 * var(--u));
		border-radius: calc(7.5 * var(--u));
		background: var(--card-wash);
	}

	/* Notes and battles stand twice the parchment's gap apart. */
	.battles {
		margin-top: calc(14 * var(--u));
	}

	/* A log rather than a figure of the warband, as on the Warband Deck's card:
	   the boxes' light wash and padding but no border and no green, a solid rule
	   under the heading and a dashed one between the rows. */
	.battles {
		padding: calc(14 * var(--u)) calc(16 * var(--u));
		border-radius: calc(7.5 * var(--u));
		background: var(--card-wash);
	}

	.battles table {
		width: 100%;
		margin-top: calc(6 * var(--u));
		/* Separate rather than collapsed, so each line belongs to exactly one cell
		   and two of them never meet in the same place. */
		border-collapse: separate;
		border-spacing: 0;
		border-top: 1.5px solid #000;
		font-family: 'Alegreya', serif;
		font-size: calc(16 * var(--t));
		line-height: 1.3;
	}

	.battles td {
		padding: calc(6 * var(--u)) calc(8 * var(--u)) calc(6 * var(--u)) 0;
		border-bottom: 1px dashed #000;
		vertical-align: baseline;
		overflow-wrap: anywhere;
	}

	/* The box's padding ends the log, not a rule of its own. */
	.battles tr:last-child td {
		padding-bottom: 0;
		border-bottom: 0;
	}

	.battles .date,
	.battles .result {
		width: 1%;
		white-space: nowrap;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.battles .date {
		padding-right: calc(16 * var(--u));
	}

	.battles .result {
		padding-right: 0;
		text-align: right;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
