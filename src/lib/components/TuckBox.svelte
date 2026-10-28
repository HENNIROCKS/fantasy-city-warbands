<script lang="ts">
	import { onMount } from 'svelte';

	/*
	 * The box the deck comes out of, as a tuck box holds a deck of playing cards:
	 * in the warband's colour on the card's texture, the warband's name, its
	 * faction and the game's logo printed on its front, a notch at the top for
	 * the thumb. It covers the cards
	 * for a moment once `ready` settles, then drops out of sight, saying when it
	 * starts and when it is gone. Until then it holds back every tap and swipe
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

	/** How long the box stands closed before it drops, in ms. */
	const HOLD = 700;
	/** How long it takes to drop, in ms. */
	const FALL = 850;

	let open = $state(false);
	let done = false;

	/* Once, from the end of the drop or, should that never be reported, a moment
	   after it: until then the box holds the cards. */
	function finish() {
		if (done) return;
		done = true;
		ondone();
	}

	onMount(() => {
		let left = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		ready.then(() => {
			if (left) return;
			timer = setTimeout(() => {
				open = true;
				onopen();
				timer = setTimeout(finish, FALL + 100);
			}, HOLD);
		});
		return () => {
			left = true;
			clearTimeout(timer);
		};
	});
</script>

<!-- Cut off at the stack's lower edge, so the box drops behind it rather than over the bar. -->
<div class="frame" aria-hidden="true">
	<div
		class="tuck"
		class:open
		style:transition="transform {FALL}ms cubic-bezier(0.45, 0, 0.7, 0.25)"
		ontransitionend={(event) => event.target === event.currentTarget && finish()}
		ontransitioncancel={(event) => event.target === event.currentTarget && finish()}
	>
		<div class="label">
			<p class="name">{name}</p>
			<p class="line">{line}</p>
			{#if logo}<img class="logo" src={logo} alt="" />{/if}
		</div>
	</div>
</div>

<style>
	.frame {
		position: absolute;
		inset: 0;
		overflow: hidden;
		z-index: 3;
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
		margin: 0;
		font-weight: 600;
		font-size: calc(32 * var(--t));
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.line {
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
