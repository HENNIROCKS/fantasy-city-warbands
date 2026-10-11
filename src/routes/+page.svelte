<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { APP_NAME, APP_TITLE, STAGE } from '$lib/app';
	import { DEFAULT_COLOUR } from '$lib/colour';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { deleteWarband, loadWarbands } from '$lib/core/storage';
	import { warbandCost, validate } from '$lib/core/validate';
	import { systems } from '$lib/systems';

	let warbands = $state(loadWarbands());

	/* The warband a delete has been asked for, held until it is confirmed. */
	let condemned = $state<string | null>(null);
	/* The Delete it was asked with, where the focus goes back to when it is not. */
	let opener: HTMLElement | null = null;

	function ask(id: string, from: HTMLElement) {
		opener = from;
		condemned = id;
	}

	/* The page takes focus again only once it is no longer inert. */
	async function cancel() {
		condemned = null;
		await tick();
		opener?.focus();
	}

	/* The warband lives on this device only, so this loses it for good. */
	function confirmDelete() {
		if (!condemned) return;
		deleteWarband(condemned);
		condemned = null;
		warbands = loadWarbands();
	}

	/* Into the sheet as it opens, on the answer that keeps the warband. */
	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	function summary(id: string) {
		const w = warbands.find((x) => x.id === id)!;
		const s = systems[w.game];
		const f = s?.factions.find((x) => x.id === w.factionId);
		const fighters = `${w.fighters.length} ${w.fighters.length === 1 ? 'fighter' : 'fighters'}`;
		if (!s || !f) return { title: w.name || 'Warband', label: 'Unknown faction', fighters, cost: '', ok: false };
		return {
			/* A warband saved without a name goes by its faction's. */
			title: w.name.trim() || f.name,
			label: `${s.game.name} · ${f.name}`,
			fighters,
			cost: `${warbandCost(w, f)} / ${s.game.budget} ${s.game.currency}`,
			ok: validate(w, s.game, f).length === 0
		};
	}
</script>

<svelte:head>
	<title>{APP_TITLE}</title>
</svelte:head>

<!-- Out of reach while the sheet asks, so the keyboard and a screen reader stay in it. -->
<div inert={condemned !== null}>
	<PageHeader title={APP_NAME} badge={STAGE} />

	<main class="mx-auto max-w-2xl space-y-6 p-5 text-sm">
		<div class="grid grid-cols-2 gap-2">
			<a
				href={resolve('/build')}
				class="flex items-center justify-center rounded bg-[#125E3C] px-8 py-4 text-center text-lg font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
			>
				New warband
			</a>
			<button
				type="button"
				class="flex cursor-not-allowed items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-8 py-4 text-center text-lg font-semibold text-zinc-200 opacity-40"
				disabled
			>
				Import warband
			</button>
		</div>

		<section>
			<p class="field-label">Your warbands</p>
			{#if warbands.length === 0}
				<p class="text-zinc-400">No warbands yet.</p>
			{:else}
				<ul class="space-y-2">
					{#each warbands as w (w.id)}
						{@const s = summary(w.id)}
						<!-- The deck's colour runs down the left edge, so a warband is found by it at a glance. -->
						<li
							class="flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-800 p-3"
							style="border-left: 10px solid {w.colour ?? DEFAULT_COLOUR}"
						>
							<!-- A warband opens as its cards; one without fighters has none yet and
							     opens where they are recruited. -->
							<a
								class="min-w-0 flex-1"
								href={w.fighters.length
									? resolve('/cards') + `?id=${w.id}`
									: resolve('/build') + `?id=${w.id}&step=fighters`}
							>
								<span class="block truncate text-base font-semibold text-zinc-200">{s.title}</span>
								<span class="block truncate text-zinc-400">{s.label}</span>
								<span class="block text-zinc-400">{[s.fighters, s.cost].filter(Boolean).join(' · ')}</span>
								<!-- Only what still needs doing takes a colour; the row's own is its deck's. -->
								{#if s.ok}
									<span class="block text-zinc-400">valid</span>
								{:else}
									<span class="block" style="color: var(--ui-warn-text)">not valid yet</span>
								{/if}
							</a>
							<!-- Stacked, so the summary keeps the width it has beside one action. The
							     column reaches to the row's edges, so the rule on its left runs from top
							     to bottom and the actions share its height evenly. -->
							<div class="-my-3 -mr-3 flex shrink-0 flex-col self-stretch overflow-hidden rounded-r-md border-l border-zinc-700">
								<a
									href={resolve('/build') + `?id=${w.id}&step=finish`}
									class="flex min-h-11 flex-1 items-center justify-center border-b border-zinc-700 px-4 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
									aria-label="Edit {s.title}">Edit</a
								>
								<button
									type="button"
									class="flex min-h-11 flex-1 items-center justify-center px-4 text-zinc-400 disabled:opacity-40"
									aria-label="Roster PDF of {s.title}"
									disabled>Roster</button
								>
								<button
									type="button"
									class="flex min-h-11 flex-1 items-center justify-center border-t border-zinc-700 px-4 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
									aria-label="Delete {s.title}"
									onclick={(event) => ask(w.id, event.currentTarget)}>Delete</button
								>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && condemned) cancel();
	}}
/>

{#if condemned}
	{@const s = summary(condemned)}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="delete-title">
			<h2 id="delete-title">Delete {s.title}?</h2>
			<p class="count">{s.label} · {s.fighters}</p>
			<p class="notice danger">
				<strong>This cannot be undone.</strong> The warband is stored on this device only.
			</p>
			<div class="sheet-actions">
				<button type="button" class="btn" onclick={cancel} use:focusOnMount>Cancel</button>
				<button type="button" class="btn danger" onclick={confirmDelete}>Delete</button>
			</div>
		</div>
	</div>
{/if}
