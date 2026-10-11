<script lang="ts">
	import RuleText from '$lib/components/RuleText.svelte';
	import ValueTable from '$lib/components/ValueTable.svelte';
	import WeaponTable from '$lib/components/WeaponTable.svelte';
	import { FRESH, type FighterBattleState } from '$lib/core/battle';
	import type { CardEntry, CardSection, FighterCardData } from '$lib/core/card';
	import { imageFieldMask } from '$lib/image-field-mask';
	import type { PhotoView } from '$lib/photo';

	let {
		card,
		columns,
		state = FRESH,
		photo = null,
		edit
	}: {
		card: FighterCardData;
		columns: string[];
		/** What the fighter has taken in the battle. The bar below the deck sets it. */
		state?: FighterBattleState;
		/** The photo of the painted model, shown in the image field where there is one. */
		photo?: PhotoView | null;
		/** Where the fighter is named, for a fighter without a name. */
		edit?: string;
	} = $props();

	/* How high the blood stands in the image field: a fighter at half its Health is
	   red to half its height. */
	const wound = $derived(card.health.value > 0 ? Math.min(1, state.damage / card.health.value) : 0);

	/* Health counts down with the damage the fighter holds, so the table reads the
	   same figure as the bar below the deck. */
	const stats = $derived(
		card.stats.map((stat) =>
			stat.key === card.health.key && state.damage
				? { ...stat, value: String(Math.max(0, card.health.value - state.damage)) }
				: stat
		)
	);

	/* General reference rather than this fighter's own rules: worth having on the
	   card, not worth the room when it is in play. Folded away, with the title in
	   the rule that separates the sections. */
	const COLLAPSIBLE: Partial<Record<CardSection['kind'], string>> = {
		faction: 'Faction Rules',
		universal: 'Universal Abilities',
		'universal-reaction': 'Universal Reactions'
	};
</script>

<article class="card" class:out={state.out} style:--wound={wound}>
	{#if state.out}
		<p class="band" aria-hidden="true">Out of Action</p>
	{/if}

	<div class="image-section">
		<div class="image-box">
			<div
				class="image-inner"
				class:photo={photo !== null}
				style="mask-image: {imageFieldMask}; -webkit-mask-image: {imageFieldMask};{photo
					? ` --photo: url(${photo.url}); --photo-size: ${photo.size}; --photo-pos: ${photo.position};`
					: ''}"
			></div>
		</div>
		<div class="image-header">
			<h2 class="name" style="--chars: {card.name.length}">
				{#if card.unnamed && edit}<a href={edit}>{card.name}</a>{:else}{card.name}{/if}
			</h2>
			{#if card.subtitle}<p class="subtitle">{card.subtitle}</p>{/if}
		</div>
	</div>

	<div class="parchment">
		{#if card.unknown}
			<p class="callout">This fighter's type is not in the faction any more.</p>
		{/if}

		{#if card.fluff}
			<p class="fluff">{card.fluff}</p>
		{/if}

		{#if card.keywords.length}
			<ul class="keywords">
				{#each card.keywords as keyword (keyword)}
					<li>{keyword}</li>
				{/each}
			</ul>
		{/if}

		<div class="profile">
			<ValueTable rows={stats} />

			<ValueTable rows={card.campaign} />

			{#if card.weapons.length}
				<WeaponTable weapons={card.weapons} {columns} />
			{/if}
		</div>

		{#each card.sections as section, i (section.kind)}
			{#if COLLAPSIBLE[section.kind]}
				<details>
					<summary>
						<span class="rule"></span>
						<span class="legend">{COLLAPSIBLE[section.kind]} ({section.entries.length})</span>
						<span class="rule"></span>
						<span class="arrow" aria-hidden="true">&#9656;</span>
					</summary>
					<div class="folded">{@render paragraphs(section.entries)}</div>
				</details>
			{:else if section.kind === 'notes'}
				<section class="notes">{@render paragraphs(section.entries)}</section>
			{:else if section.kind === 'equipment'}
				<!-- Titled like the folded sections, but open for good: what the
				     fighter carries is in play. -->
				<p class="divider">
					<span class="rule"></span>
					<span class="legend">Items</span>
					<span class="rule"></span>
				</p>
				<section>{@render paragraphs(section.entries)}</section>
			{:else}
				{#if i > 0}<hr />{/if}
				<section>{@render paragraphs(section.entries)}</section>
			{/if}
		{/each}
	</div>
</article>

<!-- Written on one line: the paragraphs are pre-wrap, so a line break in the
     template would end up on the card. A thing the game gives no text stands
     as its name alone. -->
{#snippet paragraphs(entries: CardEntry[])}
	{#each entries as entry, i (entry.label + i)}
		<p class="entry"><strong>{entry.label}</strong>{#if entry.text}: <RuleText text={entry.text} />{/if}{#if entry.note}{' '}<span class="note"><span class="lead"><svg class="check" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 5 9.5 10 2.5" /></svg>{entry.note.split(' ')[0]}</span>{#if entry.note.includes(' ')}{' '}<RuleText text={entry.note.slice(entry.note.indexOf(' ') + 1)} />{/if}</span>{/if}</p>
	{/each}
{/snippet}

<style>
	/* ── Image section ─────────────────────────── */

	.image-section {
		display: flex;
		gap: calc(12 * var(--u));
		margin: calc(16 * var(--u)) calc(38 * var(--u)) 0 calc(30 * var(--u));
	}

	.image-box {
		flex: 0 0 calc(175 * var(--u));
		height: calc(175 * var(--u));
		position: relative;
		top: calc(10 * var(--u));
	}

	/* The Card Creator's image field, cut from its mask. Without a photo it is a
	   field of the card's colour. The blood stands in it as high as the damage the
	   fighter holds, with a hard edge: a level is read off at a glance, a blend
	   has to be compared to something. Over a photo the blood is translucent,
	   denser the more Health is lost. */
	.image-inner {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			var(--card-blood) 0 calc(var(--wound, 0) * 100%),
			var(--card-green) calc(var(--wound, 0) * 100%) 100%
		);
		mask-size: 100% 100%;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
	}

	.image-inner.photo {
		background:
			linear-gradient(
				to top,
				color-mix(in srgb, var(--card-blood) calc(30% + var(--wound, 0) * 70%), transparent) 0 calc(var(--wound, 0) * 100%),
				transparent calc(var(--wound, 0) * 100%) 100%
			),
			var(--photo) var(--photo-pos) / var(--photo-size) no-repeat,
			var(--card-green);
	}

	.image-header {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0 calc(8 * var(--u));
		text-align: center;
	}

	/* Unlike the Warband Deck's, a name past 16 characters is set smaller in
	   proportion, down to 28 – still well above the subtitle – so a long name and
	   a long type do not stack four lines high beside the image. */
	.name {
		margin: 0;
		font-family: 'Grenze Gotisch', serif;
		font-weight: 600;
		font-size: clamp(calc(28 * var(--t)), calc(38 * var(--t) * 16 / var(--chars, 16)), calc(38 * var(--t)));
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	/* `Unnamed fighter` leads to where the fighter is named, in the colour of what can
	   be tapped. */
	.name a {
		color: var(--card-link);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.14em;
	}

	.subtitle {
		margin: calc(4 * var(--u)) 0 0;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	/* ── Parchment section ─────────────────────── */

	.parchment {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: calc(14 * var(--u));
		/* Deep at the foot, so the last fold is not pressed against the screen's
		   edge, where the thumb rests. */
		padding: calc(24 * var(--u)) calc(30 * var(--u)) calc(72 * var(--u));
	}

	.keywords {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: calc(8 * var(--u));
		/* Parts the fighter's name from the profile more than the parchment's own
		   gap does, so the chips read with the heading above rather than the
		   characteristics below. */
		margin: calc(16 * var(--u)) 0;
		padding: 0;
		list-style: none;
	}

	.keywords li {
		font-family: 'Alegreya', serif;
		font-size: calc(14 * var(--t));
		line-height: 1;
		text-transform: uppercase;
		border: 1px solid var(--card-green);
		border-radius: 999px;
		background: var(--card-wash);
		padding: calc(7 * var(--u)) calc(14 * var(--u));
	}

	/* Prose, not a rule: no wash, no border, set apart only by the italic. Set off
	   from the image section by a margin of its own, so it reads as its own beat
	   rather than sitting flush under the name. */
	.fluff {
		margin: calc(14 * var(--u)) 0 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		font-style: italic;
		white-space: pre-wrap;
	}

	/* The player's own notes on a light wash of their own, which parts them from
	   the rules above without a rule. */
	.notes {
		padding: calc(14 * var(--u)) calc(16 * var(--u));
		border-radius: calc(7.5 * var(--u));
		background: var(--card-wash-strong);
	}

	/* The three tables read as one block: the parchment's gap between them, roughly
	   twice that to the keywords above and the rules below. */
	.profile {
		display: flex;
		flex-direction: column;
		gap: calc(14 * var(--u));
		margin-bottom: calc(16 * var(--u));
	}

	/* Some descriptions carry their own line breaks and lists. */
	.entry {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		white-space: pre-wrap;
	}

	/* A blank line, as on the printed card. */
	.entry + .entry {
		margin-top: 1em;
	}

	/* The app speaking, not the rulebook – set apart so it is not read as part of
	   the rule above it. */
	.note {
		color: var(--card-ink-muted);
		font-style: italic;
	}

	/* The tick and the first word wrap as one, so the tick never ends a line
	   on its own. */
	.lead {
		white-space: nowrap;
	}

	/* Drawn rather than typed, so it does not depend on the card's fonts
	   carrying a tick. */
	.check {
		/* Tailwind's preflight sets every svg to block. */
		display: inline;
		width: 0.8em;
		height: 0.8em;
		margin-right: 0.25em;
		vertical-align: -0.05em;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* Parts the sections, at roughly twice the distance two paragraphs of one
	   section keep – the parchment's own gap comes on top of this margin. */
	hr {
		width: 33%;
		height: 1px;
		margin: calc(10 * var(--t)) auto;
		border: 0;
		background: var(--card-green);
	}

	/* ── Folded sections ───────────────────────── */

	details {
		margin: calc(10 * var(--t)) 0;
	}

	summary,
	.divider {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--t));
		padding: calc(4 * var(--t)) 0;
		cursor: pointer;
		list-style: none;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(18 * var(--t));
		line-height: 1;
		letter-spacing: 0.04em;
		color: var(--card-green);
	}

	.divider {
		margin: calc(10 * var(--t)) 0;
		cursor: auto;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.rule {
		flex: 1;
		height: 1px;
		background: var(--card-green);
	}

	.legend {
		flex: 0 1 auto;
	}

	.arrow {
		flex: none;
		font-size: 0.9em;
		transition: transform 120ms ease;
	}

	details[open] .arrow {
		transform: rotate(90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.arrow {
			transition: none;
		}
	}

	.folded {
		padding-top: 1em;
	}

	/* ── In battle ─────────────────────────────── */

	/* The band measures from the card, and the card clips it. Without this it
	   would hang off the pane instead, which scrolls rather than clips – the band
	   is wider than the card it lies across, so the deck would scroll sideways. */
	.card {
		position: relative;
	}

	/* The whole card is veiled in blood, so a fighter who is gone reads from
	   across the table and while flicking through the stack. */
	.card.out::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--card-blood-veil);
		pointer-events: none;
		z-index: 1;
	}

	/*
	 * Across the head of the card rather than its middle: the card scrolls and
	 * grows with its rules, so the middle is off screen on a long one. The image
	 * section is what a swipe brings up first.
	 */
	.band {
		position: absolute;
		top: calc(74 * var(--u));
		left: calc(-10 * var(--u));
		right: calc(-10 * var(--u));
		margin: 0;
		z-index: 2;
		transform: rotate(-8deg);
		padding: calc(6 * var(--u)) 0;
		background: color-mix(in srgb, var(--card-blood) 82%, transparent);
		border-top: 1px solid var(--card-wash);
		border-bottom: 1px solid var(--card-wash);
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(40 * var(--t));
		line-height: 1;
		letter-spacing: 0.08em;
		text-align: center;
		color: var(--card-paper);
		pointer-events: none;
	}
</style>
