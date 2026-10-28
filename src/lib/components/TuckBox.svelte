<script lang="ts">
	import { onMount } from 'svelte';

	/*
	 * The box the deck comes out of, as a tuck box holds a deck of playing cards:
	 * in the warband's colour on the card's texture, the warband's name, its
	 * faction and the game's logo printed on its front, a notch at the top for
	 * the thumb. It covers the cards until it is touched – a tap or the start of
	 * a swipe – or pressed from the keyboard, nudging now and then once `ready`
	 * settles to show it waits for that. Then it drops out of sight, saying when
	 * it starts and when it is gone. Until then it holds back every tap and swipe
	 * meant for the cards.
	 */
	let {
		name,
		line,
		logo,
		ready,
		onopen,
		ondone
	}: {
		name: string;
		/** The faction, under the name. */
		line: string;
		/** Where the game's logo is, set apart below the two lines; none where the game has none. */
		logo?: string;
		/** Settles once the box can be seen, as when the start screen is gone. */
		ready: Promise<void>;
		onopen: () => void;
		ondone: () => void;
	} = $props();

	/** How long it takes to drop, in ms. */
	const FALL = 850;

	/** Set once `ready` settles: from then on a touch opens the box. */
	let waiting = $state(false);
	let open = $state(false);
	let done = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	/** Opens the box once it waits; the deck calls it, too, for a tap beside it. */
	export function unbox() {
		if (!waiting || open) return;
		open = true;
		onopen();
		timer = setTimeout(finish, FALL + 100);
	}

	/* Once, from the end of the drop or, should that never be reported, a moment
	   after it: until then the box holds the cards. */
	function finish() {
		if (done) return;
		done = true;
		ondone();
	}

	onMount(() => {
		let left = false;
		ready.then(() => {
			if (!left) waiting = true;
		});
		return () => {
			left = true;
			clearTimeout(timer);
		};
	});
</script>

<!-- Cut off at the stack's lower edge, so the box drops behind it rather than over the bar.
     Opened as the finger comes down, not as it lifts: the first swipe opens it, too. -->
<button type="button" class="frame" aria-label="Open the cards" onpointerdown={unbox} onclick={unbox}>
	<span
		class="tuck"
		class:waiting={waiting && !open}
		class:open
		style:transition="transform {FALL}ms cubic-bezier(0.45, 0, 0.7, 0.25)"
		ontransitionend={(event) => event.target === event.currentTarget && finish()}
		ontransitioncancel={(event) => event.target === event.currentTarget && finish()}
	>
		<span class="label">
			<span class="name">{name}</span>
			<span class="line">{line}</span>
			{#if logo}<img class="logo" src={logo} alt="" />{/if}
		</span>
	</span>
</button>

<style>
	.frame {
		position: absolute;
		inset: 0;
		overflow: hidden;
		z-index: 3;
		padding: 0;
		border: 0;
		background: none;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}

	/*
	 * Over the whole stack, the cards showing only in the notch. It drops as
	 * things fall, slow at first and faster on. The notch is a mask: a circle of
	 * --s cut out of the top edge at --p, its two corners rounded off by circles
	 * of --r, which meet the edge at --a.
	 */
	.tuck {
		position: absolute;
		inset: 0;
		container-type: inline-size;
		background: var(--card-texture) center / cover no-repeat var(--card-green);
		background-blend-mode: multiply;
		--r: 20px;
		--s: 40px;
		--a: 20deg;
		--p: 50%;
		--_m: var(--r), #000 calc(100% - 1px), #0000;
		--_d: (var(--s) + var(--r)) * cos(var(--a));
		mask:
			radial-gradient(var(--r) at calc(var(--p) + var(--_d)) var(--_m)),
			radial-gradient(var(--r) at calc(var(--p) - var(--_d)) var(--_m)),
			radial-gradient(var(--s) at var(--p) calc(-1 * sin(var(--a)) * var(--s)), #0000 100%, #000 calc(100% + 1px)) 0
				calc(var(--r) * (1 - sin(var(--a)))) no-repeat,
			linear-gradient(90deg, #000 calc(var(--p) - var(--_d)), #0000 0 calc(var(--p) + var(--_d)), #000 0);
	}

	.tuck.open {
		transform: translateY(100%);
	}

	/* A short dip the way it drops and back, as if tugged at: it opens at a
	   touch. On `translate`, which leaves the drop's `transform` alone. */
	.tuck.waiting {
		animation: nudge 2.5s ease-in-out 1s infinite;
	}

	@keyframes nudge {
		0%,
		24%,
		100% {
			translate: 0 0;
		}
		10% {
			translate: 0 10px;
		}
	}

	/* In the banderole's lettering and the card's type unit, the faction nearly
	   as large as the name: the box spans the stack, the card the stack less its
	   gutters. Above the middle, where a box's label sits. */
	.label {
		position: absolute;
		top: 30%;
		left: 0;
		right: 0;
		--t: max(0.9px, calc((100cqw - 2 * var(--deck-gutter)) / var(--card-design-width)));
		padding: 0 calc(50 * var(--t));
		text-align: center;
		font-family: 'Grenze Gotisch', serif;
		color: var(--card-paper);
	}

	.name {
		display: block;
		margin: 0;
		font-weight: 600;
		font-size: calc(32 * var(--t));
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.line {
		display: block;
		margin: calc(2 * var(--t)) 0 0;
		font-size: calc(28 * var(--t));
		line-height: 1.2;
	}

	/* White as the start screen draws it, near enough the paper of the type. */
	.logo {
		display: block;
		width: 42%;
		margin: 28px auto 0;
		filter: brightness(0) invert(1);
	}
</style>
