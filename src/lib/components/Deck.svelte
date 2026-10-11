<script lang="ts">
	import { onMount } from 'svelte';
	import BattleBar from '$lib/components/BattleBar.svelte';
	import Explanation from '$lib/components/Explanation.svelte';
	import FighterCard from '$lib/components/FighterCard.svelte';
	import WarbandCard from '$lib/components/WarbandCard.svelte';
	import { outOfAction, stateOf, type BattleState } from '$lib/core/battle';
	import type { DeckCard } from '$lib/core/card';
	import { explanation } from '$lib/explanation';

	/*
	 * The warband and its fighters as a stack of cards, as the Wyrdcry Warband
	 * Deck holds them: one on top, the next beneath it, swiped off sideways with
	 * a finger or the mouse, or moved with the arrow keys. The stack is closed –
	 * behind the last card comes the first again.
	 */
	let {
		cards,
		columns,
		edit,
		battle = null,
		sound = true,
		onwound,
		onend,
		onsound
	}: {
		cards: DeckCard[];
		columns: string[];
		/** Where the warband is named, for the warband card to point to while it has no name. */
		edit?: string;
		battle?: BattleState | null;
		/** Whether a fighter going out of action is heard. */
		sound?: boolean;
		onwound?: (instanceId: string, delta: number, health: number) => void;
		onend?: () => void;
		onsound?: () => void;
	} = $props();

	/** Duration of the fly-out; the same number drives transition and switch point. */
	const FLY = 260;
	/** Fraction of the width past which a released card flies out instead of springing back. */
	const DISTANCE = 0.25;
	/** Flick: from this speed in px/ms a short distance counts too. */
	const VELOCITY = 0.5;

	let stack: HTMLDivElement | undefined = $state();
	let current = $state(0);
	/** Horizontal offset of the top card under the finger. */
	let dx = $state(0);
	let dragging = $state(false);
	/** Direction the card is flying out in: -1 left, 1 right, 0 = it rests. */
	let leaving = $state(0);
	let reduced = $state(false);

	let pointer: number | null = null;
	let startX = 0;
	let startTime = 0;
	let captured = false;

	const wrap = (index: number) => ((index % cards.length) + cards.length) % cards.length;

	/* A card removed elsewhere leaves the stack shorter than the place it stood at. */
	$effect.pre(() => {
		if (current >= cards.length) current = 0;
	});

	/**
	 * Beneath the top card lies the one the current direction points at: to the
	 * left the next fighter, to the right the previous one.
	 */
	const beneath = $derived(cards.length > 1 ? wrap(current + (dx > 0 ? -1 : 1)) : -1);

	const duration = $derived(reduced ? 0 : FLY);

	/* The bar below the stack belongs to the card on top of it. */
	const topFighter = $derived.by(() => {
		const top = cards[current];
		return top?.kind === 'fighter' ? top : null;
	});
	const out = $derived(
		outOfAction(
			battle,
			cards.filter((c) => c.kind === 'fighter').map((c) => c.instanceId)
		)
	);

	const transform = $derived(
		leaving
			? `translateX(${leaving * 125}%) rotate(${leaving * 18}deg)`
			: `translateX(${dx}px) rotate(${dx * 0.04}deg)`
	);

	/** The card underneath grows to full size while the one above is dragged. */
	const progress = $derived(
		leaving ? 1 : Math.min(1, Math.abs(dx) / ((stack?.clientWidth ?? 320) * DISTANCE))
	);

	onMount(() => {
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => (reduced = query.matches);
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	function onPointerDown(event: PointerEvent) {
		if (cards.length < 2 || leaving) return;
		pointer = event.pointerId;
		startX = event.clientX;
		startTime = event.timeStamp;
		captured = false;
		dragging = true;
		dx = 0;
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointer) return;
		dx = event.clientX - startX;
		/* Only once it is clear this is a drag – a tap must not grab the card. */
		if (!captured && Math.abs(dx) > 6) {
			(event.currentTarget as Element).setPointerCapture(event.pointerId);
			captured = true;
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointer) return;
		dragging = false;
		pointer = null;

		const width = stack?.clientWidth ?? 320;
		const velocity = dx / Math.max(1, event.timeStamp - startTime);
		const far = Math.abs(dx) > width * DISTANCE;
		const fast = Math.abs(velocity) > VELOCITY;

		if (far || fast) fly(dx < 0 ? -1 : 1);
		else dx = 0;
	}

	/**
	 * The browser takes over vertical scrolling itself (touch-action: pan-y) and
	 * then cancels the gesture – the half-dragged card belongs back in place.
	 */
	function onPointerCancel() {
		dragging = false;
		pointer = null;
		dx = 0;
	}

	/**
	 * A drag that springs back still ends in a click on whatever lies under the
	 * finger. On a weapon's name that would open its rules, so a gesture that
	 * got as far as a drag swallows its click.
	 */
	function onClickCapture(event: MouseEvent) {
		if (!captured) return;
		event.stopPropagation();
		event.preventDefault();
		captured = false;
	}

	function fly(direction: -1 | 1) {
		if (leaving) return;
		/* Without a drag (keyboard) the sign `beneath` reads the direction from is missing. */
		if (dx === 0) dx = direction;
		leaving = direction;
		setTimeout(() => {
			current = wrap(current + (direction < 0 ? 1 : -1));
			leaving = 0;
			dx = 0;
		}, duration);
	}

	/** From the warband card's roster: the fighter's card goes on top. */
	function jumpTo(instanceId: string) {
		if (leaving) return;
		const index = cards.findIndex((c) => c.instanceId === instanceId);
		if (index >= 0) current = index;
	}

	function onKeyDown(event: KeyboardEvent) {
		/* The open explanation keeps the keys for itself. */
		if (cards.length < 2 || explanation()) return;
		if (event.key === 'ArrowRight') fly(-1);
		else if (event.key === 'ArrowLeft') fly(1);
		else return;
		event.preventDefault();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="deck">
	<div class="stack" class:dragging bind:this={stack}>
		{#if beneath >= 0}
			{#key cards[beneath].instanceId}
				<div
					class="pane under"
					class:locked={explanation() !== null}
					style:transform="scale({0.94 + 0.06 * progress})"
					style:opacity={0.55 + 0.45 * progress}
					aria-hidden="true"
					inert
				>
					{@render face(cards[beneath])}
				</div>
			{/key}
		{/if}

		{#key cards[current].instanceId}
			<div
				class="pane top"
				class:locked={explanation() !== null}
				role="group"
				aria-roledescription="Card, swipe horizontally"
				aria-label="Card {current + 1} of {cards.length}"
				style:transform
				style:opacity={leaving ? 0 : 1}
				style:transition={dragging
					? 'none'
					: `transform ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${duration}ms ease-out`}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerCancel}
				onclickcapture={onClickCapture}
			>
				<div class="face">
					{@render face(cards[current])}
				</div>
			</div>
		{/key}

		<!-- Lies on the card: the stroke marks the place in the stack where the eye
		     already is. Outside the panes, so it neither scrolls with the card nor
		     travels with a swipe. A single card is its own whole stack, and one
		     stroke across the full width reads as an ornament, not a place. -->
		{#if cards.length > 1}
			<div class="ticks" aria-hidden="true">
				{#each cards as card, i (card.instanceId)}
					<span
						class="tick"
						class:active={i === current}
						class:out={card.kind === 'fighter' && stateOf(battle, card.instanceId).out}
					></span>
				{/each}
			</div>
		{/if}
	</div>

	<BattleBar
		fighter={topFighter ? stateOf(battle, topFighter.instanceId) : null}
		health={topFighter?.health.value ?? 0}
		{out}
		running={battle !== null}
		{sound}
		onwound={(delta) => topFighter && onwound?.(topFighter.instanceId, delta, topFighter.health.value)}
		{onend}
		{onsound}
	/>
</div>

{#snippet face(data: DeckCard)}
	{#if data.kind === 'warband'}
		<WarbandCard card={data} onpick={jumpTo} {edit} />
	{:else}
		<FighterCard card={data} {columns} state={stateOf(battle, data.instanceId)} />
	{/if}
{/snippet}

<!-- Outside the stack: inside a pane, the transform would become the frame a
     fixed overlay is placed against. -->
<Explanation />

<style>
	.deck {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
	}

	/*
	 * The width lives here rather than on the card, because the stack is also
	 * what the swipe measures itself against: a card held narrower than its
	 * stack would ask for a drag far wider than the card itself.
	 */
	.stack {
		position: relative;
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: calc(var(--deck-max-width) + 2 * var(--deck-gutter));
		margin-inline: auto;
	}

	/* A drag with the mouse moves the card without selecting any text. */
	.stack.dragging {
		user-select: none;
		-webkit-user-select: none;
	}

	/* The card is what scrolls here, not the page, and its scrolling stays
	   inside it rather than dragging the page along. */
	.pane {
		position: absolute;
		inset: 0;
		padding: 0 var(--deck-gutter);
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}

	/* An open explanation holds the card still behind it. */
	.pane.locked {
		overflow-y: hidden;
	}

	.top {
		/* The browser scrolls vertically, horizontal is left for the swipe gesture. */
		touch-action: pan-y;
		will-change: transform;
		z-index: 1;
	}

	/* The card's full height: it is a column the card stretches in. */
	.face {
		display: flex;
		flex-direction: column;
		min-height: 100%;
	}

	.face > :global(.card) {
		flex: 1;
	}

	.under {
		overflow: hidden;
		pointer-events: none;
	}

	/* Inside the gutter, so the row spans exactly the card's width – which puts the
	   outermost strokes over the card's rounded corners, and `top` is the radius
	   itself to clear them at every card size. It marks, it does not take a tap:
	   the swipe underneath reaches through it. */
	.ticks {
		position: absolute;
		top: calc(14 * var(--deck-unit));
		left: var(--deck-gutter);
		right: var(--deck-gutter);
		display: flex;
		/* The strokes differ in height, and stretched they all would not. */
		align-items: center;
		gap: 4px;
		z-index: 2;
		pointer-events: none;
	}

	/* Ink on paper rather than one of the UI colours: the strokes lie on the
	   card, and the card is light whatever the interface around it does. */
	.tick {
		flex: 1;
		min-width: 0;
		height: 4px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.16);
		transition:
			background 120ms ease,
			height 120ms ease;
	}

	.tick.active {
		height: 7px;
		background: rgba(0, 0, 0, 0.55);
	}

	/* A fighter out of action keeps its stroke in blood, so the stack shows who is
	   gone without flicking through it. */
	.tick.out {
		background: color-mix(in srgb, var(--card-blood) 55%, transparent);
	}

	.tick.active.out {
		background: var(--card-blood);
	}

	@media (prefers-reduced-motion: reduce) {
		.tick {
			transition: none;
		}
	}
</style>
