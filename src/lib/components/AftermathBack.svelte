<script lang="ts">
	import { toggleOut, xpEarned, type AftermathDraft } from '$lib/core/aftermath';
	import { RESULT_LABELS, displayDate, opponent } from '$lib/core/history';
	import type { Aftermath, BattleRecord, Faction, GameSystem, Warband } from '$lib/core/types';

	/*
	 * The back of the warband card as a battle ends, as the Wyrdcry Warband Deck
	 * asks it: the result and the shards with what they bring, who was taken
	 * out of action and what each rolled, who earned experience, and the line
	 * in the battle history. The dice are rolled at the table; the back offers
	 * the table to tap the result. Apply in the bar below
	 * writes it all at once.
	 */
	let {
		name,
		warband,
		faction,
		game,
		rules,
		draft = $bindable()
	}: {
		name: string;
		/** The warband as it stands before the battle is written in. */
		warband: Warband;
		faction: Faction;
		game: GameSystem;
		/** The game's aftermath, which the back asks. */
		rules: Aftermath;
		draft: AftermathDraft;
	} = $props();

	const earned = $derived(rules.income(warband, game, draft.result, draft.shards));

	const nameOf = (instanceId: string) => warband.fighters.find((f) => f.instanceId === instanceId)?.name.trim() || 'Unnamed fighter';

	/* Each fighter out of action with the table it rolls on, in the warband's
	   order; one that never rolls is named under them with the rule that says so. */
	const injuries = $derived(game.injuries);
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
					if (!table) return [];
					const picked = draft.injuries[instance.instanceId];
					const rolled = picked ? table.results.find((r) => r.id === picked) : undefined;
					return [{ instance, table, rolled, resolution: rolled ? injuries.resolve(instance, type, faction, rolled.id) : null }];
				})
			: []
	);
	const exempt = $derived(
		injuries
			? outFighters.flatMap(({ instance, type }) => {
					const rule = injuries.exempt(instance, type, faction);
					return rule ? [`${nameOf(instance.instanceId)} (${rule})`] : [];
				})
			: []
	);

	/* A tap picks the result; on the picked one, a tap takes it back and opens the table again. */
	function roll(instanceId: string, id: string) {
		if (draft.injuries[instanceId] === id) delete draft.injuries[instanceId];
		else draft.injuries[instanceId] = id;
	}

	function pick(result: BattleRecord['result']) {
		draft.result = draft.result === result ? null : result;
	}

	/* One fighter at most: a tap moves the point, a second tap takes it back. */
	function toggleBonus(instanceId: string) {
		draft.bonus = draft.bonus === instanceId ? null : instanceId;
	}
</script>

<article class="card back">
	<h2 class="name">{name}</h2>

	<div class="parchment">
		<section>
			<h3 class="heading"><span id="aftermath-result">Result</span><span class="rule"></span></h3>
			<div class="toggles" role="group" aria-labelledby="aftermath-result">
				{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
					<button class="toggle" aria-pressed={draft.result === key} onclick={() => pick(key as BattleRecord['result'])}>
						{label}
					</button>
				{/each}
			</div>
			{#if !draft.result}<p class="hint">Pick the result to end the battle.</p>{/if}
		</section>

		<section>
			<h3 class="heading"><span id="aftermath-shards">Shards delivered</span><span class="rule"></span></h3>
			<div class="toggles" role="group" aria-labelledby="aftermath-shards">
				<button class="toggle" aria-label="One shard less" disabled={draft.shards <= 0} onclick={() => (draft.shards -= 1)}>−</button>
				<output class="count">{draft.shards}</output>
				<button class="toggle" aria-label="One shard more" onclick={() => (draft.shards += 1)}>+</button>
			</div>
			{#each earned.lines as line (line.gain)}
				<p class="sum"><span class="gain">{line.gain}</span> {line.why}</p>
			{/each}
		</section>

		{#if injuries}
			<section>
				<h3 class="heading"><span id="aftermath-out">Taken out of action</span><span class="rule"></span></h3>
				<div class="toggles" role="group" aria-labelledby="aftermath-out">
					{#each warband.fighters as fighter (fighter.instanceId)}
						<button class="toggle" aria-pressed={draft.out.includes(fighter.instanceId)} onclick={() => toggleOut(draft, rules, fighter.instanceId)}>
							{nameOf(fighter.instanceId)}
						</button>
					{/each}
				</div>
				{#if !draft.out.length}<p class="hint">Nobody, so there are no injuries to roll.</p>{/if}
			</section>

			{#each rolling as { instance, table, rolled, resolution } (instance.instanceId)}
				<section>
					<h3 class="heading">
						<span>{nameOf(instance.instanceId)}</span><span class="rule"></span><span class="dice">{table.dice}</span>
					</h3>
					<div class="toggles" role="group" aria-label="{table.table} for {nameOf(instance.instanceId)}">
						{#each rolled ? [rolled] : table.results as result (result.id)}
							<button class="toggle" aria-pressed={rolled?.id === result.id} onclick={() => roll(instance.instanceId, result.id)}>
								<span class="roll">{result.roll}</span> {result.name}
							</button>
						{/each}
					</div>
					{#if resolution}
						{#if resolution.note}<p class="hint">{resolution.note}</p>{/if}
						<p class="sum">
							{#if resolution.note}<strong>{resolution.result.name}:</strong>{' '}{/if}{resolution.result.text}
						</p>
					{:else}
						<p class="hint">Tap the result of the {table.dice} roll.</p>
					{/if}
				</section>
			{/each}

			{#if exempt.length}
				<p class="hint">Never roll for injuries: {exempt.join(', ')}</p>
			{/if}
		{/if}

		<section>
			<h3 class="heading"><span>Experience</span><span class="rule"></span></h3>
			<p class="hint">For {draft.rows.length} {draft.rows.length === 1 ? 'fighter' : 'fighters'}.</p>
		</section>

		{#each draft.rows as row (row.instanceId)}
			{@const points = xpEarned(row, draft.bonus)}
			<section>
				<h3 class="heading">
					<span>{row.name}</span><span class="rule"></span>
					<span class="gain" class:none={points === 0}>+{points} XP</span>
				</h3>
				<div class="toggles" role="group" aria-label="Experience for {row.name}">
					{#each rules.questions as question (question.key)}
						<button
							class="toggle"
							aria-pressed={row.answers[question.key] ?? false}
							onclick={() =>
								question.start === 'not-out' ? toggleOut(draft, rules, row.instanceId) : (row.answers[question.key] = !row.answers[question.key])}
						>
							{question.label}
						</button>
					{/each}
					{#if rules.bonus}
						<button class="toggle" aria-pressed={draft.bonus === row.instanceId} onclick={() => toggleBonus(row.instanceId)}>
							Bonus
						</button>
					{/if}
				</div>
			</section>
		{/each}

		{#if draft.excluded.length}
			<p class="hint">Never earn experience: {draft.excluded.join(', ')}</p>
		{/if}

		<section>
			<h3 class="heading"><span>Battle history</span><span class="rule"></span></h3>
			<div class="toggles">
				<button class="toggle" aria-pressed={draft.record} disabled={!draft.result} onclick={() => (draft.record = !draft.record)}>
					Add to the battle history
				</button>
			</div>
			{#if draft.recorded}
				{@const r = draft.recorded}
				<p class="hint">Already in the history: {displayDate(r.date)} {opponent(r)} – {RESULT_LABELS[r.result]}</p>
			{/if}
			{#if draft.result && draft.record}
				<input type="text" placeholder="Opponent's warband" aria-label="Opponent's warband" autocomplete="off" bind:value={draft.opponentWarband} />
				<input type="text" placeholder="Opponent's name" aria-label="Opponent's name" autocomplete="off" bind:value={draft.opponentPlayer} />
			{/if}
		</section>
	</div>
</article>

<style>
	/* One section per fighter: closer together than the back's own sections,
	   or a full roster runs to several screens. */
	.card.back .parchment {
		gap: calc(36 * var(--u));
	}

	/* What the row earns, in the green the card marks a gain with; a row that
	   earns nothing keeps the place, so the rule does not jump as it is answered. */
	.gain {
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
		letter-spacing: 0;
		color: var(--card-green);
		font-variant-numeric: lining-nums tabular-nums;
	}

	.gain.none {
		color: var(--card-ink-muted);
	}

	/* The dice a fighter rolls, where a row of experience shows its points. */
	.dice {
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
		letter-spacing: 0;
		color: var(--card-ink);
	}

	/* The roll ahead of the result's name, in figures that line up. */
	.roll {
		font-variant-numeric: lining-nums tabular-nums;
	}

	/* What the result and the shards come to, a line for each. */
	.sum {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		color: var(--card-ink);
	}

	/* The fields as on the card's own back: a lighter patch of the paper. */
	input {
		width: 100%;
		margin: 0;
		padding: calc(6 * var(--u)) calc(10 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		color: var(--card-ink);
		background: var(--card-field);
		border: 0;
		border-radius: calc(6 * var(--u));
		outline: none;
		appearance: none;
	}

	input:focus {
		background: rgb(255 255 255 / 0.7);
		box-shadow: inset 0 0 0 1px var(--card-green);
	}

	::placeholder {
		color: var(--card-ink-muted);
		font-style: italic;
	}
</style>
