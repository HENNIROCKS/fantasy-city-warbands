<script lang="ts">
	import { onMount, tick, untrack, type Snippet } from 'svelte';
	import BattleBar from '$lib/components/BattleBar.svelte';
	import Explanation from '$lib/components/Explanation.svelte';
	import FighterCard from '$lib/components/FighterCard.svelte';
	import TuckBox from '$lib/components/TuckBox.svelte';
	import WarbandCard from '$lib/components/WarbandCard.svelte';
	import { battleEffects, downCount, isWavering, isWounded, outOfAction, reached, remaining, stateOf, type BattleState } from '$lib/core/battle';
	import type { DeckCard, FighterCardData } from '$lib/core/card';
	import type { FactionCounter, GameSystem } from '$lib/core/types';
	import { explanation } from '$lib/explanation';
	import type { PhotoView } from '$lib/photo';

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
		rules,
		counter,
		onwound,
		onactivated,
		onwaiting,
		onmark,
		onuse,
		onunuse,
		oncount,
		onstart,
		onnext,
		onundo,
		onend,
		oncancelbattle,
		levelsOpen = 0,
		levelLabel = '',
		healthLabel = '',
		onlevels,
		onunderdog,
		onhire,
		hireLabel = '',
		onrolls,
		rollsLabel = '',
		onshow,
		readonly = false,
		editing = false,
		doneDisabled = false,
		closed = null,
		back,
		onedit,
		ondone,
		oncancel,
		photos,
		tuck = null,
		ontucked
	}: {
		cards: DeckCard[];
		columns: string[];
		/** Where a card's warband or fighter is named, for the card to point to while it has no name. */
		edit?: (card: DeckCard) => string;
		battle?: BattleState | null;
		/** Whether a fighter going out of action is heard. */
		/** What the game tracks in a battle beyond rounds, activations and damage. */
		rules?: GameSystem['battle'];
		/** What the faction counts through a battle, such as Zeal. */
		counter?: FactionCounter;
		onwound?: (instanceId: string, delta: number, health: number) => void;
		onactivated?: (instanceId: string) => void;
		onwaiting?: (instanceId: string) => void;
		onmark?: (instanceId: string, key: string) => void;
		/** Ticks off a fighter's single-use piece, on the weapon picked where it picks one; offered while a battle runs. */
		onuse?: (instanceId: string, wargear: string, on?: string) => void;
		/** Takes a fighter's use of a piece back, by its place among the fighter's uses. */
		onunuse?: (instanceId: string, at: number) => void;
		oncount?: (delta: number) => void;
		onstart?: () => void;
		onnext?: () => void;
		onundo?: () => void;
		/** Asks to end the battle, with how many fighters are out of action. */
		onend?: (out: number) => void;
		/** Drops the battle without its aftermath; only where the game has one. */
		oncancelbattle?: (out: number) => void;
		/** How many of the fighters' levels are open, and what a level is called: `Renown`. */
		levelsOpen?: number;
		levelLabel?: string;
		/** What the game calls the characteristic damage counts down: `Health`, `Life`. */
		healthLabel?: string;
		onlevels?: () => void;
		/** Opens the question whether the warband is the underdog, where the game has one and the battle is still being set up. */
		onunderdog?: () => void;
		/** Opens what is on offer for hire, where the game hires and the battle is still being set up. */
		onhire?: () => void;
		/** What the game calls the fighters hired, many of them: `Hired swords`. */
		hireLabel?: string;
		/** Opens the fighters' rolls before the battle, where any has one and the battle is still being set up. */
		onrolls?: () => void;
		/** What the menu calls them, with how many are still to roll: `Prepared spells (2 to roll)`. */
		rollsLabel?: string;
		/** Opens the code that shows the opponent the warband, while no battle runs. */
		onshow?: () => void;
		/** Cards only to look at, as an opponent sees them: no battle bar, nothing to turn over. */
		readonly?: boolean;
		/** Whether the card on top is turned over to its back, to be written on. */
		editing?: boolean;
		/** Holds that button back while what the turned card holds would break the warband's limits. */
		doneDisabled?: boolean;
		/** Why no battle starts, as for a disbanded warband; null where one can. */
		closed?: string | null;
		/** The back of the card on top, shown while `editing`. */
		back?: Snippet<[DeckCard]>;
		/** Asks for the card on top to be turned over, by its instanceId – the warband's id for the warband card. */
		onedit?: (instanceId: string) => void;
		ondone?: () => void;
		oncancel?: () => void;
		/** The fighters' photos by instanceId, for the image field. */
		photos?: Map<string, PhotoView>;
		/** The box the deck comes out of, with what its front names and when it can be seen; null for none. */
		tuck?: { name: string; line: string; logo?: string; ready: Promise<void> } | null;
		/** Says the box has slid out of sight. */
		ontucked?: () => void;
	} = $props();

	/** Duration of the fly-out; the same number drives transition and switch point. */
	const FLY = 260;
	/** Duration of each half of turning a card over. */
	const TURN = 220;
	/** How the cards settle as their box drops: a little up and larger, past their place and back.
	    The delay counts from the box starting to drop; how long it falls, TuckBox sets. */
	const UNBOX = { duration: 800, delay: 50, easing: 'cubic-bezier(0.25, 1.2, 0.5, 1)', fill: 'backwards' } as const;
	/** Fraction of the width past which a released card flies out instead of springing back. */
	const DISTANCE = 0.25;
	/** Flick: from this speed in px/ms a short distance counts too. */
	const VELOCITY = 0.5;

	let stack: HTMLDivElement | undefined = $state();
	let current = $state(0);
	let topPane: HTMLDivElement | undefined = $state();
	let face: HTMLDivElement | undefined = $state();
	/** The side of the card on top that is in view – it trails `editing` by half a turn. */
	let shown = $state(false);
	/** Horizontal offset of the top card under the finger. */
	let dx = $state(0);
	let dragging = $state(false);
	/** Direction the card is flying out in: -1 left, 1 right, 0 = it rests. */
	let leaving = $state(0);
	let reduced = $state(false);
	/** Whether the box has started to drop, the cards rising out of it. */
	let unboxed = $state(false);

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
	const fighterIds = $derived(cards.filter((c) => c.kind === 'fighter').map((c) => c.instanceId));
	const out = $derived(outOfAction(battle, fighterIds));
	const toAct = $derived(remaining(battle, fighterIds));
	/* A hired fighter acts with the rest but leaves the warband's morale and its flee test alone. */
	const roster = $derived(
		cards.flatMap((c) => (c.kind === 'fighter' && !c.hired ? [{ instanceId: c.instanceId, weight: c.weight, health: c.health.value }] : []))
	);
	const wavering = $derived(rules?.wavering ? isWavering(battle, roster, rules.wavering.wavers) : false);
	/* Whether the end of this round asks the warband's flee test. */
	const fleeing = $derived(rules?.flee && battle ? rules.flee.breaks(downCount(battle, roster, rules.wounded), roster.length) : false);
	const stage = $derived(counter && battle ? (reached(counter.stages, battle.counter).at(-1) ?? null) : null);

	/** What the battle does to one fighter's card – its single-use pieces used after the marks – and whether the wavering warband asks it for a test. */
	function inBattle(card: FighterCardData) {
		const state = stateOf(battle, card.instanceId);
		const effects = battleEffects(state, rules?.marks ?? [], battle ? (counter?.stages ?? []) : [], { label: counter?.label ?? '', value: battle?.counter ?? 0 }, card.keywordIds);
		/* Asked in the round after a morale phase in which the warband wavered, and
		   due until the fighter has acted or waited – it rolled then – or failed it. */
		const morale = rules?.wavering;
		const due = morale && battle?.morale && !state.out && !state.activated && !state.waiting && !state.marks[morale.failed];
		const wounded = rules?.wounded && isWounded(state, card.health.value, rules.wounded) ? [rules.wounded.label] : [];
		return {
			state,
			...effects,
			labels: [...wounded, ...effects.labels, ...card.inUse.labels],
			layers: [...effects.layers, ...card.inUse.layers],
			test: due ? morale.test : null
		};
	}

	/* The marks the fighter on top can carry: one bound to a keyword only for its carriers. */
	const topMarks = $derived(
		topFighter
			? (rules?.marks ?? [])
					.filter((m) => !m.keyword || topFighter.keywordIds.includes(m.keyword))
					.map((m) => ({ key: m.key, label: m.label, on: !!stateOf(battle, topFighter.instanceId).marks[m.key] }))
			: []
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

	/* Out of the box: the cards rise from where `.tucked` holds them, a little
	   lower and smaller, as from inside it. On `translate` and `scale`, which
	   leave the swipe's `transform` and transition alone. */
	function unbox() {
		unboxed = true;
		for (const el of stack?.querySelectorAll<HTMLElement>(':scope > .pane') ?? []) {
			el.animate([{ translate: '0 12px', scale: 0.96 }, { translate: '0 0', scale: 1 }], UNBOX);
		}
	}

	onMount(() => {
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => (reduced = query.matches);
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	/*
	 * Turned in two halves: the front edge-on, then the back swapped in and
	 * turned up from the other edge. Only one side is ever in the pane, so two
	 * sides of different heights never have to share its scroll.
	 */
	$effect(() => {
		void editing;
		untrack(turn);
	});

	/** Set while the first half runs, which a second call waits out rather than overlapping. */
	let turning = false;

	/*
	 * Each half reads `editing` as it is then, not as it was when the turn began:
	 * Cancel tapped before the card is edge-on brings the front back up, rather
	 * than leaving the back in view with nothing to finish it.
	 */
	async function turn() {
		if (turning || editing === shown) return;
		if (reduced || !face) {
			shown = editing;
			if (topPane) topPane.scrollTop = 0;
			return;
		}
		turning = true;
		/* Held edge-on once there: without the fill the front would spring back
		   flat for a frame before the back is swapped in. */
		const away = face.animate(
			[{ transform: 'perspective(1200px) rotateY(0)' }, { transform: 'perspective(1200px) rotateY(90deg)' }],
			{ duration: TURN, easing: 'ease-in', fill: 'forwards' }
		);
		await away.finished;
		shown = editing;
		if (topPane) topPane.scrollTop = 0;
		await tick();
		/* The curve a swiped card flies out on, so the back settles rather than lands. */
		face?.animate(
			[{ transform: 'perspective(1200px) rotateY(-90deg)' }, { transform: 'perspective(1200px) rotateY(0)' }],
			{ duration: TURN, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' }
		);
		away.cancel();
		turning = false;
		/* Changed again while the side was being swapped. */
		if (editing !== shown) turn();
	}

	function onPointerDown(event: PointerEvent) {
		/* A turned card stays put: a finger scrolling through its fields is not a swipe. */
		if (cards.length < 2 || leaving || editing) return;
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
		if (leaving || editing) return;
		const index = cards.findIndex((c) => c.instanceId === instanceId);
		if (index >= 0) current = index;
	}

	function onKeyDown(event: KeyboardEvent) {
		/* The open explanation keeps the keys for itself, and the arrows move the
		   caret in a field on the back, not the deck. The box holds the deck still. */
		if (cards.length < 2 || explanation() || editing || tuck) return;
		if (event.key === 'ArrowRight') fly(-1);
		else if (event.key === 'ArrowLeft') fly(1);
		else return;
		event.preventDefault();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="deck">
	<div class="stack" class:dragging class:boxed={!!tuck} class:tucked={!!tuck && !unboxed} bind:this={stack}>
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
					{@render front(cards[beneath])}
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
				bind:this={topPane}
			>
				<div class="face" bind:this={face}>
					{#if shown && back}
						{@render back(cards[current])}
					{:else}
						{@render front(cards[current])}
					{/if}
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
					{@const state = card.kind === 'fighter' ? stateOf(battle, card.instanceId) : null}
					<span
						class="tick"
						class:active={i === current}
						class:activated={state?.activated}
						class:waiting={state?.waiting}
						class:out={state?.out}
					></span>
				{/each}
			</div>
		{/if}

		{#if tuck}
			<TuckBox name={tuck.name} line={tuck.line} logo={tuck.logo} ready={tuck.ready} onopen={unbox} ondone={() => ontucked?.()} />
		{/if}
	</div>

	<!-- An opponent's view of the cards has nothing to count and nothing to turn over. -->
	{#if !readonly}
		<BattleBar
			{battle}
			fighter={topFighter ? stateOf(battle, topFighter.instanceId) : null}
			health={topFighter?.health.value ?? 0}
			{healthLabel}
			waiting={rules?.waiting ?? false}
			marks={topMarks}
			rounds={rules?.rounds}
			{counter}
			stage={stage?.label ?? null}
			{wavering}
			flee={fleeing ? rules?.flee : undefined}
			{toAct}
			{out}
			onwound={(delta) => topFighter && onwound?.(topFighter.instanceId, delta, topFighter.health.value)}
			onactivated={() => topFighter && onactivated?.(topFighter.instanceId)}
			onwaiting={() => topFighter && onwaiting?.(topFighter.instanceId)}
			onmark={(key) => topFighter && onmark?.(topFighter.instanceId, key)}
			{oncount}
			{onstart}
			{onnext}
			{onundo}
			onend={() => onend?.(out)}
			oncancelbattle={oncancelbattle && (() => oncancelbattle(out))}
			{levelsOpen}
			{levelLabel}
			{onlevels}
			{editing}
			{doneDisabled}
			{closed}
			editable={!topFighter?.hired}
			onedit={() => onedit?.(cards[current].instanceId)}
			{onunderdog}
			{onhire}
			{hireLabel}
			{onrolls}
			{rollsLabel}
			{onshow}
			{ondone}
			{oncancel}
		/>
	{/if}
</div>

{#snippet front(data: DeckCard)}
	{#if data.kind === 'warband'}
		<WarbandCard card={data} onpick={jumpTo} edit={edit?.(data)} />
	{:else}
		{@const view = inBattle(data)}
		<FighterCard
			card={data}
			{columns}
			state={view.state}
			marks={view.labels}
			layers={view.layers}
			conditions={view.conditions}
			test={view.test}
			photo={photos?.get(data.instanceId) ?? null}
			edit={edit?.(data)}
			onuse={battle && onuse ? (wargear, on) => onuse(data.instanceId, wargear, on) : undefined}
			onunuse={(at) => onunuse?.(data.instanceId, at)}
		/>
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

	/* Holds the cards inside the stack while the box is there, whatever pose and
	   overshoot they are given, rather than showing below it. */
	.stack.boxed {
		overflow: hidden;
	}

	/* The strokes come in once the box is gone, with the cards settled. */
	.boxed > .ticks {
		opacity: 0;
	}

	/* Inside the box until it drops: the pose `unbox` starts from. */
	.tucked > .pane {
		translate: 0 12px;
		scale: 0.96;
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

	/* Between the pane and the card, so a turn moves the card and not the scroll
	   box. Still the card's full height: it is a column the card stretches in. */
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
		transition: opacity 200ms;
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

	/* Height rather than colour alone, and declared before the states so they
	   keep the colour: a fighter who has acted is still marked as such while
	   their card is the one on top. */
	.tick.active {
		height: 7px;
		background: rgba(0, 0, 0, 0.55);
	}

	/* Who has acted is struck out in light, who waits is picked out in the card
	   green because they are still to come. Light rather than a paler ink: as
	   the Warband Deck measured it against the card's texture, a lighter stroke
	   stands 2.5:1 off its neighbours where a paler one manages 1.1:1. */
	.tick.activated {
		background: rgba(255, 255, 255, 0.75);
	}

	.tick.waiting {
		background: var(--card-green);
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
