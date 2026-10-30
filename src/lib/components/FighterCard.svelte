<script lang="ts">
	import ItemTable from '$lib/components/ItemTable.svelte';
	import RuleText from '$lib/components/RuleText.svelte';
	import ValueTable from '$lib/components/ValueTable.svelte';
	import WeaponTable from '$lib/components/WeaponTable.svelte';
	import { FRESH, type BattleCondition, type BattleLayer, type FighterBattleState } from '$lib/core/battle';
	import { floored, type CardEntry, type CardSection, type CardValue, type FighterCardData, type StatLayer } from '$lib/core/card';
	import { formatStat } from '$lib/core/warband';
	import { imageFieldMask } from '$lib/image-field-mask';
	import type { PhotoView } from '$lib/photo';

	let {
		card,
		columns,
		state = FRESH,
		marks = [],
		layers = [],
		conditions = [],
		test = null,
		photo = null,
		edit,
		onuse,
		onunuse
	}: {
		card: FighterCardData;
		columns: string[];
		/** What the fighter has taken in the battle. The bar below the deck sets it. */
		state?: FighterBattleState;
		/** The marks it carries, by label, in the order the band names them. */
		marks?: string[];
		/** What the battle adds to its characteristics, and from what. */
		layers?: BattleLayer[];
		/** What the battle changes in one situation only, such as cover. */
		conditions?: BattleCondition[];
		/** What the wavering warband asks of it before it acts, such as `Bravery test`; null where nothing. */
		test?: string | null;
		/** The photo of the painted model, shown in the image field where there is one. */
		photo?: PhotoView | null;
		/** Where the fighter is named, for a fighter without a name. */
		edit?: string;
		/** Given while a battle runs: ticks off a single-use piece, on the weapon picked where it picks one. */
		onuse?: (wargear: string, on?: string) => void;
		/** Takes a single-use piece's use back, by its place among the fighter's uses. */
		onunuse?: (at: number) => void;
	} = $props();

	/* The card names the state, the bar changes it – one band, the worst of the
	   three, because a fighter out of action is neither waiting nor to be read as
	   having merely acted. Without one, the band says why an injury keeps the
	   fighter out, such as Captured. */
	const band = $derived(state.out ? 'Out of Action' : state.waiting ? 'Waiting' : state.activated ? 'Activated' : (card.away ?? ''));

	/* How high the blood stands in the image field: a fighter at half its Health is
	   red to half its height. */
	const wound = $derived(card.health.value > 0 ? Math.min(1, state.damage / card.health.value) : 0);

	/* The player's photo, else the picture the fighter's data brings, filling the field. */
	const shown = $derived(photo ?? (card.image ? { url: card.image, size: 'cover', position: '50% 50%' } : null));

	/* Where there is no picture, the field carries the fighter's initials: first
	   and last word of the name, or of the type for a fighter without a name; a
	   hyphen divides words. A single word gives its first two letters, a type of
	   one word its first. */
	const initials = $derived.by(() => {
		const first = (word: string) => word.match(/\p{L}/u)?.[0] ?? '';
		const words = (card.unnamed ? card.subtitle : card.name).trim().split(/[\s-]+/);
		if (words.length > 1) return (first(words[0]) + first(words[words.length - 1])).toUpperCase();
		const [one = '', two = ''] = words[0].match(/\p{L}/gu) ?? [];
		return card.unnamed ? one.toUpperCase() : one.toUpperCase() + two.toLowerCase();
	});

	/* Each figure as the Warband Deck's card reads it: the layers the card was
	   built with, then the battle's own – what a mark or a stage of the faction's
	   count adds, kept above the game's floor, and last the damage Health counts
	   down, so the table reads the same figure as the bar below the deck. A figure made of more than the profile,
	   or one a situation can still change, opens its explanation when tapped; the
	   star says the latter, which a tag alone would not. */
	const stats = $derived(
		card.stats.map((stat): CardValue => {
			if (!stat.layers || stat.amount === undefined || !stat.format) return stat;
			const damage = stat.key === card.health.key ? Math.min(state.damage, stat.amount) : 0;
			const all: StatLayer[] = [
				...floored(
					[...stat.layers, ...layers.filter((l) => l.stat === stat.key).map((l) => ({ kind: 'battle' as const, source: l.source, amount: l.amount }))],
					stat.floor
				),
				...(damage ? [{ kind: 'damage' as const, source: 'Damage', amount: -damage }] : [])
			];
			const situations = [...(stat.conditions ?? []), ...conditions.filter((c) => c.stat === stat.key).map((c) => ({ source: c.source, name: c.name, text: c.text, amount: c.bonus }))];
			const shown = formatStat({ key: stat.key, label: stat.label, format: stat.format }, all.reduce((sum, l) => sum + l.amount, 0));
			return {
				...stat,
				value: shown + (situations.length ? '*' : ''),
				explanation: all.length > 1 || situations.length ? { title: stat.label, result: shown, layers: all, conditions: situations } : undefined
			};
		})
	);

	/* General reference rather than this fighter's own rules: worth having on the
	   card, not worth the room when it is in play. Folded away, with the title in
	   the rule that separates the sections. */
	const COLLAPSIBLE: Partial<Record<CardSection['kind'], string>> = {
		faction: 'Faction Rules',
		'universal-action': 'Universal Actions',
		universal: 'Universal Abilities',
		'universal-reaction': 'Universal Reactions'
	};
</script>

<article class="card" class:dulled={band !== ''} class:out={state.out} style:--wound={wound}>
	<!-- The test takes the first band's place, which is free by definition while
	     it is due. Something to do this round, like the states that band names,
	     but the card stays undulled: the fighter has not acted yet. -->
	{#if band}
		<p class="band" aria-hidden="true">{band}</p>
	{:else if test}
		<p class="band" aria-hidden="true">{test}</p>
	{/if}
	{#if marks.length}
		<p class="band quiet" aria-hidden="true">{marks.join(' · ')}</p>
	{/if}

	<div class="image-section">
		<div class="image-box">
			<div
				class="image-inner"
				class:photo={shown !== null}
				class:preset={photo === null && shown !== null}
				style="mask-image: {imageFieldMask}; -webkit-mask-image: {imageFieldMask};{shown
					? ` --photo: url(${shown.url}); --photo-size: ${shown.size}; --photo-pos: ${shown.position};`
					: ''}"
			></div>
			{#if !shown && initials}<span class="initials" aria-hidden="true">{initials}</span>{/if}
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

			{#if card.items.length}
				<ItemTable items={card.items} {onuse} {onunuse} />
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

	/* The Card Creator's image field, cut from its mask. Without a photo or a
	   picture it is a field of the card's colour. The blood stands in it as high
	   as the damage the fighter holds, with a hard edge: a level is read off at a
	   glance, a blend has to be compared to something. Over a photo the blood is
	   translucent, denser the more Health is lost. */
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

	/* A watermark over the field and its blood; decoration, the name beside it
	   carries the text. */
	.initials {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Grenze Gotisch', serif;
		font-weight: 600;
		font-size: calc(100 * var(--u));
		line-height: 1;
		color: rgb(255 255 255 / 0.32);
		pointer-events: none;
	}

	/* A picture from the data is black on white: screened over the card's colour,
	   its ink takes the warband's colour and its paper stays white. */
	.image-inner.preset {
		background-blend-mode: normal, screen;
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

	summary {
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

	/* The whole card dulls, so a fighter who has acted is recognisable while
	   flicking through the stack rather than only when read. */
	.card.dulled::after {
		content: '';
		position: absolute;
		inset: 0;
		background: rgba(18, 18, 22, 0.44);
		pointer-events: none;
		z-index: 1;
	}

	/* Out of action is the same veil in blood rather than ink: at the table the
	   difference between a fighter who has acted and one who is gone has to read
	   from across the board. */
	.card.out::after {
		background: var(--card-blood-veil);
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
		background: rgba(18, 18, 22, 0.72);
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

	.card.out .band {
		background: color-mix(in srgb, var(--card-blood) 82%, transparent);
	}

	/* The same ribbon, held back: half the type size, a thinner ink and no second
	   pair of rules, so the state of the round keeps the eye and this one is read
	   after it rather than with it. One band names every mark, so however many
	   there are it ends above the keywords; a long list breaks onto a second
	   line, kept off the card's edges by the inline padding, since the band
	   reaches past them.

	   `top` adds the first band's own box – its padding, line height and border –
	   plus a fixed clearance, rather than naming a unit offset of its own: below
	   529px card width `--t` floors while `--u` keeps shrinking, so a flat number
	   that clears the box at one width closes the gap at another. */
	.band.quiet {
		top: calc(94 * var(--u) + 40 * var(--t) + 2px);
		padding: calc(4 * var(--u)) calc(30 * var(--u));
		background: rgba(18, 18, 22, 0.58);
		border-top-color: transparent;
		border-bottom-color: transparent;
		font-size: calc(21 * var(--t));
		letter-spacing: 0.05em;
	}

	.card.out .band.quiet {
		background: rgba(18, 18, 22, 0.58);
	}
</style>
