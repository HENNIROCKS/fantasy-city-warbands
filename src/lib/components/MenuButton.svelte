<script lang="ts">
	import type { Snippet } from 'svelte';

	/*
	 * A button that opens a short menu of entries, as the Wyrdcry Warband Deck's
	 * battle bar has it. The entries come from the caller; every one does
	 * something, and then the menu is done.
	 */
	let {
		label,
		class: triggerClass = '',
		trigger,
		children
	}: {
		/** What the menu is for, for a screen reader and as the tooltip. */
		label: string;
		/** The trigger's own look, which the bar it sits in decides. */
		class?: string;
		trigger: Snippet;
		children: Snippet;
	} = $props();

	const id = $props.id();

	let button: HTMLButtonElement | undefined = $state();
	let menu: HTMLDivElement | undefined = $state();

	/**
	 * A popover lives in the top layer, where the trigger's position is no longer
	 * known to it – the browser centres it instead. So the panel is placed by hand
	 * beside the trigger and flush with its right edge, right before it opens:
	 * below the trigger where there is room, above it where there is not. The
	 * battle bar sits at the bottom edge, so there it opens upwards.
	 */
	function onBeforeToggle(event: ToggleEvent) {
		if (event.newState !== 'open' || !button || !menu) return;
		const rect = button.getBoundingClientRect();
		menu.style.right = `${window.innerWidth - rect.right}px`;

		/* The panel is still closed at this point, and a closed one is
		   `display: none` and has no height. So it is laid out for the length of a
		   measurement, unseen. */
		menu.style.display = 'block';
		menu.style.visibility = 'hidden';
		menu.style.top = '0';
		menu.style.bottom = 'auto';
		const height = menu.getBoundingClientRect().height;
		menu.style.display = '';
		menu.style.visibility = '';

		if (rect.bottom + 6 + height <= window.innerHeight) {
			menu.style.top = `${rect.bottom + 6}px`;
			menu.style.bottom = 'auto';
		} else {
			menu.style.top = 'auto';
			menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
		}
	}

	/*
	 * The menu closes on the way up from whichever entry was pressed. The listener
	 * is bound here rather than in the markup: the panel is a container, not
	 * something one clicks, and an `onclick` on it would claim otherwise.
	 */
	$effect(() => {
		const panel = menu;
		if (!panel) return;
		const close = (event: Event) => {
			if ((event.target as HTMLElement).closest('button, a')) panel.hidePopover();
		};
		panel.addEventListener('click', close);
		return () => panel.removeEventListener('click', close);
	});
</script>

<button class={triggerClass} bind:this={button} popovertarget={id} aria-label={label} title={label}>
	{@render trigger()}
</button>

<div class="menu" bind:this={menu} {id} popover onbeforetoggle={onBeforeToggle}>
	{@render children()}
</div>

<style>
	.menu {
		/* The UA centres a popover with `inset: 0` and auto margins. */
		position: fixed;
		inset: auto;
		margin: 0;
		min-width: 190px;
		padding: 5px;
		border: 1px solid var(--ui-border);
		border-radius: 8px;
		background: var(--ui-surface);
		color: var(--ui-text);
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
		/* The app's type wherever the trigger sits, a card's cell included, whose
		   lettering it would otherwise inherit. */
		font-family: var(--default-font-family, ui-sans-serif, system-ui, sans-serif);
		line-height: 1.5;
		font-variant-numeric: normal;
	}

	.menu:not(:popover-open) {
		display: none;
	}

	/* Entries come from the caller, so they are styled from here. */
	.menu :global(button),
	.menu :global(a) {
		display: block;
		width: 100%;
		min-height: 44px;
		padding: 10px 11px;
		border: 0;
		border-radius: 4px;
		background: none;
		font-size: 15px;
		font-weight: 600;
		text-align: left;
		text-decoration: none;
		color: inherit;
	}

	.menu :global(button:hover),
	.menu :global(button:focus-visible),
	.menu :global(a:hover),
	.menu :global(a:focus-visible) {
		background: var(--ui-surface-hover);
	}

	.menu :global(hr) {
		margin: 5px 7px;
		border: 0;
		border-top: 1px solid var(--ui-border);
	}

	/* Says what the menu acts on, is not itself an entry. */
	.menu :global(p) {
		margin: 0;
		padding: 8px 11px 6px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ui-text-subtle);
	}
</style>
