<script lang="ts">
	import RuleText from '$lib/components/RuleText.svelte';
	import ValueTable from '$lib/components/ValueTable.svelte';
	import WeaponTable from '$lib/components/WeaponTable.svelte';
	import type { CardEntry, CardSection, FighterCardData } from '$lib/core/card';
	import { imageFieldMask } from '$lib/image-field-mask';

	let { card, columns }: { card: FighterCardData; columns: string[] } = $props();

	/* General reference rather than this fighter's own rules: worth having on the
	   card, not worth the room when it is in play. Folded away, with the title in
	   the rule that separates the sections. */
	const COLLAPSIBLE: Partial<Record<CardSection['kind'], string>> = {
		faction: 'Faction Rules',
		universal: 'Universal Abilities',
		'universal-reaction': 'Universal Reactions'
	};
</script>

<article class="card">
	<div class="image-section">
		<div class="image-box">
			<div class="image-inner" style="mask-image: {imageFieldMask}; -webkit-mask-image: {imageFieldMask};"></div>
		</div>
		<div class="image-header">
			<h2 class="name" style="--chars: {card.name.length}">{card.name}</h2>
			{#if card.subtitle}<p class="subtitle">{card.subtitle}</p>{/if}
		</div>
	</div>

	<div class="parchment">
		{#if card.unknown}
			<p class="warn">This fighter's type is not in the faction any more.</p>
		{/if}

		{#if card.keywords.length}
			<ul class="keywords">
				{#each card.keywords as keyword (keyword)}
					<li>{keyword}</li>
				{/each}
			</ul>
		{/if}

		<div class="profile">
			<ValueTable rows={card.stats} />

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
		<p class="entry"><strong>{entry.label}</strong>{#if entry.text}: <RuleText text={entry.text} />{/if}</p>
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
	   field of the card's colour. */
	.image-inner {
		position: absolute;
		inset: 0;
		background: var(--card-green);
		mask-size: 100% 100%;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
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
	   proportion, down to 28 – still well above the subtitle – so `Unnamed` and a
	   long type do not stack four lines high beside the image. */
	.name {
		margin: 0;
		font-family: 'Grenze Gotisch', serif;
		font-weight: 600;
		font-size: clamp(calc(28 * var(--t)), calc(38 * var(--t) * 16 / var(--chars, 16)), calc(38 * var(--t)));
		line-height: 1.1;
		overflow-wrap: anywhere;
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

	.warn {
		margin: 0;
		padding: calc(10 * var(--u)) calc(12 * var(--u));
		border: 1px solid var(--ui-warn-border);
		border-radius: calc(7.5 * var(--u));
		background: rgba(180, 83, 9, 0.18);
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.3;
	}
</style>
