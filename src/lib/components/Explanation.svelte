<script lang="ts">
	import { page } from '$app/state';
	import RuleText from '$lib/components/RuleText.svelte';
	import { dismiss, explanation, settle } from '$lib/explanation';

	/**
	 * Set from the moment the sheet is closed until the history has stepped back
	 * off it. iOS takes its picture of an entry as the page leaves it, and the
	 * drag forward shows that picture: with the sheet already gone from the
	 * screen, it shows the card rather than a sheet that then snaps away.
	 */
	let closing = $state(false);

	const open = $derived(closing ? null : explanation());

	$effect(() => {
		void page.state;
		settle();
		if (!explanation()) closing = false;
	});

	/** Resolves once the frame after the next one has started, so the closed state is on screen. */
	const painted = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

	async function close() {
		if (closing) return;
		closing = true;
		await painted();
		dismiss();
	}

	/* Focus belongs in the dialog while it is open, and back where it came from
	   afterwards – with aria-modal set, the keyboard would otherwise carry on
	   through the card behind it. */
	let sheet: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!open) return;
		const before = document.activeElement;
		sheet?.focus();
		return () => {
			if (before instanceof HTMLElement) before.focus();
		};
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') close();
	}}
/>

{#if open}
	<!-- Clicking the backdrop closes; the sheet itself swallows the click. The
	     keyboard reaches the same thing through Escape above. -->
	<div
		class="backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) close();
		}}
	>
		<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="explanation-title" tabindex="-1" bind:this={sheet}>
			<h2 id="explanation-title">{open.title}</h2>

			<ul class="facts">
				{#each open.facts as fact (fact.label)}
					<li>
						<span>{fact.label}</span>
						<span class="amount">{fact.value}</span>
					</li>
				{/each}
			</ul>

			{#each open.rules as rule, i (rule.label + i)}
				<div class="rule">
					<p class="name">{rule.label}</p>
					{#if rule.text}<p class="text"><RuleText text={rule.text} /></p>{/if}
				</div>
			{/each}

			<button class="close" onclick={close}>Close</button>
		</div>
	</div>
{/if}

<style>
	/*
	 * The backdrop is the scroller, not the sheet. Centring a flex child that
	 * grows taller than its container pushes the top of it out of reach – the
	 * overflow goes both ways and only one of them can be scrolled to. An auto
	 * margin centres the sheet while it fits and lets it start at the top once
	 * it does not, which is the case that has to keep working.
	 */
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		background: rgba(0, 0, 0, 0.72);
		padding: 16px var(--deck-gutter);
		padding-top: calc(16px + env(safe-area-inset-top));
		padding-bottom: calc(16px + env(safe-area-inset-bottom));
	}

	/*
	 * The card's own colours, because this explains what is on the card – but
	 * flat paper rather than the texture: it lies over a parchment that already
	 * carries one, and two of them lose the edge between the two surfaces.
	 *
	 * Sizes are in pixels, not in card units. Those scale with the card's
	 * container, and this sheet stands outside it. The width is the exception:
	 * it follows the stack's, kept clear of the card's edge by --deck-inset, so
	 * the card stays visible beside what explains it. While the screen leaves
	 * less room than that width, both are as wide as the screen allows and run
	 * to the same edge.
	 */
	.sheet:focus {
		outline: none;
	}

	.sheet {
		width: 100%;
		max-width: calc(var(--deck-max-width) - 2 * var(--deck-inset) * var(--deck-unit));
		margin: auto;
		background: var(--card-paper);
		color: var(--card-ink);
		border: 1px solid var(--card-green);
		border-radius: 14px;
		padding: 16px;
	}

	h2 {
		margin: 0;
		font-family: 'Grenze Gotisch', serif;
		font-size: 22px;
		font-weight: 400;
	}

	.facts {
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--card-green);
	}

	/* The list ends on a rule; the first block below it needs to stand clear of
	   that line rather than hang off it. */
	.facts + .rule {
		margin-top: 14px;
	}

	.facts li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 7px 0;
		border-bottom: 1px solid rgba(22, 117, 74, 0.3);
		font-family: 'Alegreya', serif;
		font-size: 15px;
	}

	.amount {
		font-family: 'Grenze Gotisch', serif;
		font-variant-numeric: lining-nums tabular-nums;
	}

	/*
	 * On the card a wash alone sets a box off, because it lightens the texture
	 * underneath. This sheet is flat paper, where the same wash all but
	 * disappears – so the edge does the work here.
	 */
	.rule {
		margin-bottom: 8px;
		margin-top: 8px;
		padding: 10px 12px;
		border: 1px solid rgba(22, 117, 74, 0.35);
		border-radius: 10px;
		background: var(--card-wash-2);
	}

	.name {
		margin: 0 0 3px;
		font-family: 'Alegreya', serif;
		font-size: 15px;
		font-weight: 700;
	}

	.text {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: 15px;
		line-height: 1.45;
		white-space: pre-wrap;
	}

	/* The button in the unit this sheet is built in. */
	.close {
		width: 100%;
		margin-top: 14px;
		padding: 10px;
		font-family: 'Grenze Gotisch', serif;
		font-size: 20px;
		line-height: 1;
		letter-spacing: 0.06em;
		color: var(--card-paper);
		background: var(--card-green);
		border: 0;
		border-radius: 5px;
		cursor: pointer;
	}
</style>
