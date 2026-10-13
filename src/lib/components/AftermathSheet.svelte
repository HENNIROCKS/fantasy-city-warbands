<script lang="ts">
	import RichText from '$lib/components/RichText.svelte';
	import { toggleOut, xpEarned, type AftermathDraft } from '$lib/core/aftermath';
	import { RESULT_LABELS, displayDate, opponent } from '$lib/core/history';
	import type { Aftermath, BattleRecord, Faction, GameSystem, Warband } from '$lib/core/types';

	/*
	 * Ending a battle in pages over the deck, as a level of renown is spent: the
	 * result, the shards and the line in the battle history; who was taken out
	 * of action; one page for each of them that rolls for injuries; then who
	 * earned experience. The dice are rolled at the table and the result tapped
	 * here. Apply on the last page writes it all at once; Keep playing on the
	 * first drops the answers and goes back to the battle.
	 */
	let {
		warband,
		faction,
		game,
		rules,
		draft = $bindable(),
		onapply,
		onclose
	}: {
		/** The warband as it stands before the battle is written in. */
		warband: Warband;
		faction: Faction;
		game: GameSystem;
		rules: Aftermath;
		draft: AftermathDraft;
		onapply: () => void | Promise<void>;
		onclose: () => void;
	} = $props();

	const earned = $derived(rules.income(warband, game, draft.result, draft.shards));
	const injuries = $derived(game.injuries);

	const nameOf = (instanceId: string) => warband.fighters.find((f) => f.instanceId === instanceId)?.name.trim() || 'Unnamed fighter';

	/* Each fighter out of action with its type, in the warband's order. */
	const outFighters = $derived(
		warband.fighters.flatMap((instance) => {
			const type = faction.fighters.find((f) => f.id === instance.fighterId);
			return draft.out.includes(instance.instanceId) && type ? [{ instance, type }] : [];
		})
	);
	const rolling = $derived(
		injuries
			? outFighters.flatMap(({ instance, type }) => {
					const table = injuries.table(instance, type, faction);
					return table ? [{ instance, type, table }] : [];
				})
			: []
	);
	/* Out of action and never rolling, with the rule that says so. */
	const exempt = $derived(
		injuries
			? outFighters.flatMap(({ instance, type }) => {
					const rule = injuries.exempt(instance, type, faction);
					return rule ? [`${nameOf(instance.instanceId)} (${rule})`] : [];
				})
			: []
	);

	/* Pages come and go as fighters are taken out of action or brought back; a page is held by its key, not its place. */
	const pages = $derived([
		'battle',
		...(injuries ? ['out', ...rolling.map((r) => `roll:${r.instance.instanceId}`)] : []),
		'experience'
	]);
	let page = $state('battle');
	const at = $derived(Math.max(0, pages.indexOf(page)));
	const current = $derived(pages[at]);
	const roller = $derived(rolling.find((r) => `roll:${r.instance.instanceId}` === current) ?? null);

	const step = (by: number) => (page = pages[Math.min(pages.length - 1, Math.max(0, at + by))]);

	function pick(result: BattleRecord['result']) {
		draft.result = draft.result === result ? null : result;
	}

	/* A tap picks the result; a tap on the picked one takes it back. */
	function roll(instanceId: string, id: string) {
		if (draft.injuries[instanceId] === id) delete draft.injuries[instanceId];
		else draft.injuries[instanceId] = id;
	}

	/* One fighter at most: a tap moves the point, a second tap takes it back. */
	function toggleBonus(instanceId: string) {
		draft.bonus = draft.bonus === instanceId ? null : instanceId;
	}

	/* A second tap while the write is still running would write the battle twice. */
	let busy = $state(false);

	async function apply() {
		if (busy) return;
		busy = true;
		try {
			await onapply();
		} finally {
			busy = false;
		}
	}

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	const PRIMARY =
		'min-h-11 flex-1 rounded bg-[#125E3C] px-4 font-semibold text-white transition enabled:hover:bg-[#16754A] focus-visible:bg-[#16754A] disabled:opacity-50';
</script>

<div class="sheet-backdrop">
	<div class="bottom-sheet aftermath" role="dialog" aria-modal="true" aria-labelledby="aftermath-title">
		{#if current === 'battle'}
			<h2 id="aftermath-title">End the battle</h2>
			<p class="count">Aftermath · {at + 1} of {pages.length}</p>

			<p class="field-label" id="aftermath-result">Result</p>
			<div class="joined" role="group" aria-labelledby="aftermath-result">
				{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
					<button type="button" class="choice" aria-pressed={draft.result === key} onclick={() => pick(key as BattleRecord['result'])}>
						{label}
					</button>
				{/each}
			</div>

			<p class="field-label mt-4" id="aftermath-shards">Shards delivered</p>
			<div class="tally-row" role="group" aria-labelledby="aftermath-shards">
				<button type="button" class="tally-step" aria-label="One shard less" disabled={draft.shards <= 0} onclick={() => (draft.shards -= 1)}>−</button>
				<output class="tally-count">{draft.shards}</output>
				<button type="button" class="tally-step" aria-label="One shard more" onclick={() => (draft.shards += 1)}>+</button>
			</div>
			{#if draft.result}
				<ul class="earned">
					{#each earned.lines as line (line.gain)}
						<li><span class="font-semibold">{line.gain}</span> {line.why}</li>
					{/each}
				</ul>
			{/if}

			<p class="field-label mt-4">Battle history</p>
			<button type="button" class="choice" aria-pressed={draft.record} disabled={!draft.result} onclick={() => (draft.record = !draft.record)}>
				Add to the battle history
			</button>
			{#if draft.recorded}
				{@const r = draft.recorded}
				<p class="mt-1 text-zinc-400">Already in the history: {displayDate(r.date)} {opponent(r)} – {RESULT_LABELS[r.result]}</p>
			{/if}
			{#if draft.result && draft.record}
				<div class="mt-2 grid gap-2">
					<input class="field-input" type="text" placeholder="Opponent's warband" aria-label="Opponent's warband" autocomplete="off" bind:value={draft.opponentWarband} />
					<input class="field-input" type="text" placeholder="Opponent's name" aria-label="Opponent's name" autocomplete="off" bind:value={draft.opponentPlayer} />
				</div>
			{/if}

			<div class="sheet-actions">
				<button type="button" class="btn" onclick={onclose} use:focusOnMount>Keep playing</button>
				<button type="button" class={PRIMARY} disabled={!draft.result} onclick={() => step(1)}>
					{draft.result ? 'Next' : 'Pick the result'}
				</button>
			</div>
		{:else if current === 'out'}
			<h2 id="aftermath-title">Taken out of action</h2>
			<p class="count">Aftermath · {at + 1} of {pages.length}</p>
			<p class="notice">Who rolls for injuries. Set from the battle; tap to correct it.</p>

			<div class="mt-3 grid gap-2" role="group" aria-label="Taken out of action">
				{#each warband.fighters as fighter (fighter.instanceId)}
					<button type="button" class="choice" aria-pressed={draft.out.includes(fighter.instanceId)} onclick={() => toggleOut(draft, rules, fighter.instanceId)}>
						{nameOf(fighter.instanceId)}
					</button>
				{/each}
			</div>
			{#if exempt.length}
				<p class="mt-2 text-zinc-400">Never roll for injuries: {exempt.join(', ')}</p>
			{/if}

			<div class="sheet-actions">
				<button type="button" class="btn" onclick={() => step(-1)}>Back</button>
				<button type="button" class={PRIMARY} onclick={() => step(1)} use:focusOnMount>Next</button>
			</div>
		{:else if roller}
			{@const id = roller.instance.instanceId}
			{@const picked = draft.injuries[id]}
			{@const resolution = picked && injuries ? injuries.resolve(roller.instance, roller.type, faction, picked) : null}
			<h2 id="aftermath-title">{nameOf(id)}</h2>
			<p class="count">{roller.table.table} · {roller.table.dice} · {at + 1} of {pages.length}</p>

			<div class="grid gap-2" role="group" aria-label="{roller.table.table} for {nameOf(id)}">
				{#each roller.table.results as result (result.id)}
					{@const open = picked === result.id}
					<button type="button" class="choice" aria-pressed={open} onclick={() => roll(id, result.id)}>
						<span class="flex gap-3">
							<span class="roll tabular-nums">{result.roll}</span>
							<span class="font-semibold">{result.name}</span>
						</span>
						{#if open && resolution}
							{#if resolution.note}
								<span class="mt-1 block">{resolution.note}</span>
								<span class="mt-1 block"><strong>{resolution.result.name}:</strong> <RichText text={resolution.result.text} /></span>
							{:else}
								<span class="mt-1 block"><RichText text={result.text} /></span>
							{/if}
						{/if}
					</button>
				{/each}
			</div>

			<div class="sheet-actions">
				<button type="button" class="btn" onclick={() => step(-1)}>Back</button>
				<button type="button" class={PRIMARY} onclick={() => step(1)}>{picked ? 'Next' : 'Skip'}</button>
			</div>
		{:else}
			<h2 id="aftermath-title">Experience</h2>
			<p class="count">Aftermath · {at + 1} of {pages.length}</p>

			{#each draft.rows as row (row.instanceId)}
				{@const points = xpEarned(row, draft.bonus)}
				<p class="field-label mt-4 flex justify-between">
					<span>{row.name}</span><span class="tabular-nums">+{points} XP</span>
				</p>
				<div class="grid grid-cols-2 gap-2" role="group" aria-label="Experience for {row.name}">
					{#each rules.questions as question (question.key)}
						<button
							type="button"
							class="choice"
							aria-pressed={row.answers[question.key] ?? false}
							onclick={() =>
								question.start === 'not-out' ? toggleOut(draft, rules, row.instanceId) : (row.answers[question.key] = !row.answers[question.key])}
						>
							{question.label}
						</button>
					{/each}
					{#if rules.bonus}
						<button type="button" class="choice" aria-pressed={draft.bonus === row.instanceId} onclick={() => toggleBonus(row.instanceId)}>Bonus</button>
					{/if}
				</div>
			{/each}
			{#if draft.excluded.length}
				<p class="mt-3 text-zinc-400">Never earn experience: {draft.excluded.join(', ')}</p>
			{/if}

			<div class="sheet-actions">
				<button type="button" class="btn" onclick={() => step(-1)}>Back</button>
				<button type="button" class={PRIMARY} disabled={busy} onclick={apply} use:focusOnMount>Apply</button>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Tall with a table or a full roster: the sheet scrolls rather than the page
	   behind it, and its answers stay at its foot. */
	.aftermath {
		max-height: calc(100dvh - 24px - env(safe-area-inset-bottom));
		overflow-y: auto;
		padding-bottom: 0;
	}

	.aftermath .sheet-actions {
		position: sticky;
		bottom: 0;
		margin-inline: -16px;
		padding: 12px 16px 16px;
		background: var(--ui-surface);
		border-top: 1px solid var(--ui-border);
	}

	/* The result as one pill of three, as the battles on the back of the warband card. */
	.joined {
		display: flex;
	}

	.joined .choice {
		flex: 1;
		text-align: center;
		border-radius: 0;
	}

	.joined .choice:first-child {
		border-radius: 6px 0 0 6px;
	}

	.joined .choice:last-child {
		border-radius: 0 6px 6px 0;
	}

	/* Two neighbouring frames share one line instead of doubling it. */
	.joined .choice + .choice {
		margin-left: -1px;
	}

	.joined .choice[aria-pressed='true'] {
		position: relative;
	}

	.earned {
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
		color: var(--ui-text-muted);
	}

	/* The rolls in a column of their own, so the names line up. */
	.roll {
		min-width: 3.5ch;
	}
</style>
