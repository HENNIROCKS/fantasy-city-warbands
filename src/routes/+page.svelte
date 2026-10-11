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
			label: `${s.game.name} • ${f.name}`,
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
							<!-- Two by two and as icons, so the summary keeps most of the row's width.
							     The grid reaches to the row's edges, so its rules run from edge to edge
							     and the actions share the row's height evenly. Delete sits in the corner
							     furthest from Edit. A disabled action fades its icon, not its rules. -->
							<div class="-my-3 -mr-3 grid shrink-0 grid-cols-2 grid-rows-2 self-stretch overflow-hidden rounded-r-md border-l border-zinc-700">
								<a
									href={resolve('/build') + `?id=${w.id}&step=finish`}
									class="flex min-h-11 w-11 items-center justify-center border-r border-b border-zinc-700 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
									aria-label="Edit {s.title}"
									title="Edit"
								>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<path d="M10.5 2.5l3 3L6 13H3v-3z" />
										<line x1="9" y1="4" x2="12" y2="7" />
									</svg>
								</a>
								<button
									type="button"
									class="flex min-h-11 w-11 items-center justify-center border-b border-zinc-700 text-zinc-400 disabled:*:opacity-40"
									aria-label="Roster PDF of {s.title}"
									title="Roster PDF"
									disabled
								>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<path d="M3.5 1.5h6l3 3v10h-9z" />
										<path d="M9.5 1.5v3h3" />
										<line x1="6" y1="8.5" x2="10" y2="8.5" />
										<line x1="6" y1="11.5" x2="10" y2="11.5" />
									</svg>
								</button>
								<button
									type="button"
									class="flex min-h-11 w-11 items-center justify-center border-r border-zinc-700 text-zinc-400 disabled:*:opacity-40"
									aria-label="Export {s.title} as JSON"
									title="Export as JSON"
									disabled
								>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<line x1="8" y1="2" x2="8" y2="10" />
										<polyline points="4.5 6.5 8 10 11.5 6.5" />
										<path d="M2.5 10.5v3h11v-3" />
									</svg>
								</button>
								<button
									type="button"
									class="flex min-h-11 w-11 items-center justify-center text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
									aria-label="Delete {s.title}"
									title="Delete"
									onclick={(event) => ask(w.id, event.currentTarget)}
								>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<line x1="2.5" y1="4" x2="13.5" y2="4" />
										<path d="M6 4V2.5h4V4" />
										<path d="M4 4l.8 9.5h6.4L12 4" />
									</svg>
								</button>
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
