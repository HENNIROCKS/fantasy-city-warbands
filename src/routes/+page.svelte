<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_NAME, APP_TITLE, STAGE } from '$lib/app';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { deleteWarband, loadWarbands } from '$lib/core/storage';
	import { warbandCost, validate } from '$lib/core/validate';
	import { systems } from '$lib/systems';

	let warbands = $state(loadWarbands());

	function remove(id: string, label: string) {
		if (!confirm(`Delete “${label}”?`)) return;
		deleteWarband(id);
		warbands = loadWarbands();
	}

	function summary(id: string) {
		const w = warbands.find((x) => x.id === id)!;
		const s = systems[w.game];
		const f = s?.factions.find((x) => x.id === w.factionId);
		if (!s || !f) return { title: w.name || 'Warband', label: 'Unknown faction', cost: '', ok: false };
		return {
			/* A warband saved without a name goes by its faction's. */
			title: w.name.trim() || f.name,
			label: `${s.game.name} · ${f.name} · ${w.fighters.length} fighters`,
			cost: `${warbandCost(w, f)} / ${s.game.budget} ${s.game.currency}`,
			ok: validate(w, s.game, f).length === 0
		};
	}
</script>

<svelte:head>
	<title>{APP_TITLE}</title>
</svelte:head>

<PageHeader title={APP_NAME} badge={STAGE} />

<main class="mx-auto max-w-2xl space-y-6 p-5 text-sm">
	<a
		href={resolve('/build')}
		class="block rounded bg-[#125E3C] px-8 py-4 text-center text-lg font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
	>
		New warband
	</a>

	<section>
		<p class="field-label">Your warbands</p>
		{#if warbands.length === 0}
			<p class="text-zinc-400">No warbands yet.</p>
		{:else}
			<ul class="space-y-2">
				{#each warbands as w (w.id)}
					{@const s = summary(w.id)}
					<li class="flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-800 p-3">
						<a class="min-w-0 flex-1" href={resolve('/build') + `?id=${w.id}`}>
							<span class="block truncate text-base font-semibold text-zinc-200">{s.title}</span>
							<span class="block truncate text-zinc-400">{s.label}</span>
							<span class="block" style="color: {s.ok ? 'var(--ui-sel-text)' : 'var(--ui-warn-text)'}">
								{s.cost} · {s.ok ? 'legal' : 'not legal yet'}
							</span>
						</a>
						<!-- Stacked, so the summary keeps the width it has beside one action. The
						     column reaches to the row's edges, so the rule on its left runs from top
						     to bottom and each action fills its half. -->
						<div class="-my-3 -mr-3 flex shrink-0 flex-col self-stretch overflow-hidden rounded-r-md border-l border-zinc-700">
							{#if w.fighters.length}
								<a
									href={resolve('/cards') + `?id=${w.id}`}
									class="flex min-h-11 flex-1 items-center justify-center border-b border-zinc-700 px-4 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
									aria-label="Cards of {s.title}">Cards</a
								>
							{/if}
							<button
								type="button"
								class="flex min-h-11 flex-1 items-center justify-center px-4 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white"
								aria-label="Delete {s.title}"
								onclick={() => remove(w.id, s.title)}>Delete</button
							>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>
