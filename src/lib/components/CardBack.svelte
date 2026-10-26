<script lang="ts" module>
	import type { Advance, AwayReason, LevelOffer, OpenLevel } from '$lib/core/types';
	import type { StoredPhoto } from '$lib/photo';

	/** What the back of a fighter's card writes with Done. */
	export interface BackDraft {
		/** Blank for a fighter not yet named. */
		name: string;
		fluff: string;
		notes: string;
		/** The game's campaign counters for the fighter, such as renown, by key. */
		tally: Record<string, number>;
		/** What the fighter has bought, as stored – what its profile brings is not in here. */
		wargear: string[];
		/** The warband's stash, which the fighter hands pieces to and takes them from. */
		stash: string[];
		/** What the fighter's levels were spent on, in order, those spent on this back included. */
		advances: Advance[];
		/** The ids of the injury results the fighter keeps, in order, less those removed on this back. */
		injuries: string[];
		/** Why an injury keeps the fighter out, null where nothing does or it was cleared on this back. */
		away: AwayReason | null;
		/** Whether the fighter takes the lead of a warband that lost its leader. */
		lead: boolean;
		/** Whether the roll recovered what a dead leader still on the roster carried, as it leaves. */
		recovered: boolean;
	}

	/** What taking the lead on this back asks, worked out by the page; null where the fighter may not take it. */
	export interface BackLead {
		/** The keyword the game asks of a new leader, as the rules print it: `HERO`. */
		keyword: string;
		/** The dead leaders still on the roster, with the names of what they carried: they leave it once the lead is taken. */
		dead: { name: string; carried: string[] }[];
	}

	/** What the back may move between the fighter and the stash, worked out by the page from the draft. */
	export interface BackEquipment {
		/** Why nothing can change hands here, such as a battle going on; null where it can. */
		blocked: string | null;
		/** Why the fighter takes no wargear at all, as its profile says; null where it takes some. */
		takesNothing: string | null;
		/** The names of `draft.wargear`, in its order. */
		carried: string[];
		/** `draft.stash` in its order, each with why the fighter cannot take it. */
		stash: { name: string; refused: string | null }[];
		/** Where the fighter buys, in the builder: what it may carry is decided there. */
		buy: string;
	}

	/** What dismissing the fighter on this back would mean, worked out by the page. */
	export interface BackDismissal {
		/** The names of what the fighter carries as stored, in its order – the places the stash is handed. */
		carried: string[];
		/** Why the fighter cannot be dismissed now, or null when it can. */
		blocked: string | null;
	}

	/** What the game's campaign lets the back correct by hand; null where it keeps none. */
	export interface BackCampaign {
		/** Without `raise` a counter only comes down, for a fighter that never gains it and has some from a file. */
		counters: { key: string; label: string; raise: boolean }[];
		/** The counter the levels are counted in, which never goes below a level spent; null where none. */
		levels: string | null;
	}

	/** The levels of the fighter on this back, worked out by the page from the draft. */
	export interface BackRenown {
		/** What a level is called: `Renown`. */
		label: string;
		/** The first level still open, and what it can be spent on. */
		next: { level: OpenLevel; offer: LevelOffer } | null;
		/** Every level still open, `next` included. */
		waiting: number;
		/** `draft.advances` in a line each, in its order. */
		spent: { level: number; text: string }[];
	}

	/** The fighter's photo as it stands on the back; `changed` says whether Done has to write it. */
	export interface BackPhoto {
		photo: StoredPhoto | null;
		changed: boolean;
	}
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import LevelPicker from '$lib/components/LevelPicker.svelte';
	import { AWAY_LABELS } from '$lib/core/card';
	import { grow } from '$lib/grow';
	import { imageFieldMask } from '$lib/image-field-mask';
	import { CENTRE, MAX_ZOOM, PhotoError, panCrop, photoLayout, readPhoto, zoomCrop, type PhotoCrop } from '$lib/photo';

	/*
	 * The back of a fighter's card, turned over to be written on, as the Wyrdcry
	 * Warband Deck has it: the name across the top, then sections under a word in
	 * the card's script and a rule out to the edge. What the rules decide – the
	 * fighter's type, choice and wargear – stays in the builder.
	 */
	let {
		name,
		placeholder,
		draft = $bindable(),
		photo = $bindable(),
		campaign,
		renown,
		injuries,
		lead,
		equipment,
		dismissal,
		ondismiss
	}: {
		name: string;
		/** What the name field offers while it is blank. */
		placeholder: string;
		draft: BackDraft;
		photo: BackPhoto;
		campaign: BackCampaign | null;
		renown: BackRenown | null;
		/** The names of `draft.injuries`, in its order; null where the game has no injuries. */
		injuries: string[] | null;
		lead: BackLead | null;
		equipment: BackEquipment | null;
		dismissal: BackDismissal | null;
		/** Asks for the fighter to be dismissed, handing the places of what goes to the stash. */
		ondismiss: (toStash: number[]) => void;
	} = $props();

	/* Every piece goes to the stash unless taken off: the Campaign Book has the
	   equipment deposited, and the fighter leaves with what is left. */
	let leaves = $state<number[]>([]);
	const toggleLeaves = (i: number) => (leaves = leaves.includes(i) ? leaves.filter((j) => j !== i) : [...leaves, i]);

	/* A piece changes hands within the draft; no gold moves, in the builder neither. */
	function toStash(index: number) {
		const id = draft.wargear[index];
		if (id === undefined) return;
		draft.wargear = draft.wargear.filter((_, i) => i !== index);
		draft.stash = [...draft.stash, id];
	}

	function take(index: number) {
		const id = draft.stash[index];
		if (id === undefined) return;
		draft.stash = draft.stash.filter((_, i) => i !== index);
		draft.wargear = [...draft.wargear, id];
	}

	function step(key: string, by: number) {
		draft.tally = { ...draft.tally, [key]: (draft.tally[key] ?? 0) + by };
	}

	/* No level spent is taken away; one taken back with Undo frees the counter again. */
	const spentTo = $derived(Math.max(0, ...draft.advances.map((a) => a.level)));
	const floorOf = (key: string) => (key === campaign?.levels ? spentTo : 0);

	/* The back has a second page for spending a level, as in the Warband Deck: it
	   takes the card's place rather than opening a sheet over it, so the choice
	   is part of the draft and Cancel drops it like everything else. */
	let spending = $state(false);
	let talking = $state(false);
	let article: HTMLElement | undefined = $state();
	let campaignSection: HTMLElement | undefined = $state();

	const next = $derived(spending ? (renown?.next ?? null) : null);
	/* A level that asks only for a talent opens on them; one that asks for no talent has none. */
	const onRules = $derived(!!next && next.offer.rules.length > 0 && (next.offer.stats.length === 0 || talking));
	const open = $derived(
		next ? next.offer.stats.some((s) => s.blocked === null) || next.offer.rules.some((g) => g.options.some((o) => o.blocked === null)) : false
	);

	async function showSpending(on: boolean) {
		spending = on;
		talking = false;
		await tick();
		/* The page swapped under a finger that was halfway down the card. */
		(on ? article : campaignSection)?.scrollIntoView({ block: 'start' });
	}

	/* A level that asks for a characteristic and a talent stays on this page for the second part. */
	async function choose(pick: Omit<Advance, 'level'>) {
		if (!next) return;
		const { level } = next.level;
		draft.advances = [...draft.advances, { level, ...pick }];
		talking = false;
		await tick();
		if (renown?.next?.level.level !== level) showSpending(false);
	}

	/** Only the last: the choices after a level were offered on the figures it left. */
	function undoLast() {
		draft.advances = draft.advances.slice(0, -1);
	}

	let photoInput: HTMLInputElement | undefined = $state();
	let photoError = $state<string | null>(null);

	/* The preview is drawn from an object URL of the photo as it stands on the
	   back, handed back when the photo is replaced or the back goes away. Moving
	   or zooming keeps the bytes, so it keeps the URL. */
	const stored = $derived(photo.photo);
	const bytes = $derived(stored?.bytes ?? null);
	const layout = $derived(stored ? photoLayout(stored.width, stored.height, stored.crop) : null);
	let previewUrl = $state<string | null>(null);
	$effect(() => {
		if (!bytes) {
			previewUrl = null;
			return;
		}
		const url = URL.createObjectURL(new Blob([bytes], { type: untrack(() => stored?.type) }));
		previewUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	let preview: HTMLDivElement | undefined = $state();
	/* The finger doing the dragging; a second one on the preview is left out. */
	let dragFrom: { id: number; x: number; y: number } | null = null;

	/* Every change of the crop is one Done has to write. */
	function recrop(crop: (c: PhotoCrop) => PhotoCrop) {
		if (!photo.photo) return;
		photo = { photo: { ...photo.photo, crop: crop(photo.photo.crop) }, changed: true };
	}

	function startDrag(event: PointerEvent) {
		if (dragFrom) return;
		preview?.setPointerCapture(event.pointerId);
		dragFrom = { id: event.pointerId, x: event.clientX, y: event.clientY };
	}

	function endDrag(event: PointerEvent) {
		if (event.pointerId === dragFrom?.id) dragFrom = null;
	}

	function drag(event: PointerEvent) {
		if (!dragFrom || event.pointerId !== dragFrom.id || !preview || !photo.photo) return;
		const { width, height } = photo.photo;
		const dx = event.clientX - dragFrom.x;
		const dy = event.clientY - dragFrom.y;
		dragFrom = { id: event.pointerId, x: event.clientX, y: event.clientY };
		recrop((c) => panCrop(c, width, height, preview!.clientWidth, dx, dy));
	}

	async function pickPhoto(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		/* Reset, otherwise the same photo does not fire a change event twice. */
		input.value = '';
		if (!file) return;
		photoError = null;
		try {
			photo = { photo: await readPhoto(file), changed: true };
		} catch (error) {
			photoError = error instanceof PhotoError ? error.message : 'This photo could not be read.';
		}
	}
</script>

<article class="card back" bind:this={article}>
	<h2 class="name">{name}</h2>

	{#if next && renown}
		<div class="parchment">
			<section>
				<button class="back-link" onclick={() => showSpending(false)}>‹ Back</button>
				<h3 class="heading"><span>{renown.label} {next.level.level}</span><span class="rule"></span></h3>
				<p class="note">{next.level.note}</p>

				{#if next.offer.rules.length && next.offer.stats.length}
					<div class="tabs" role="group" aria-label="What to spend the level on">
						<button aria-pressed={!talking} class:on={!talking} onclick={() => (talking = false)}>Characteristics</button>
						<button aria-pressed={talking} class:on={talking} onclick={() => (talking = true)}>{next.offer.rulesLabel}</button>
					</div>
				{/if}

				{#if onRules}
					<LevelPicker offer={next.offer} onpick={choose} />
				{:else}
					<div class="options">
						{#each next.offer.stats as option (option.stat)}
							<button class="option" disabled={option.blocked !== null} onclick={() => choose({ stat: option.stat, bonus: option.bonus })}>
								<span class="line">
									{option.label}
									{#if option.blocked}<span class="why">{option.blocked}</span>{/if}
								</span>
								<span class="change">{option.blocked ? option.from : `${option.from} → ${option.to}`}</span>
							</button>
						{/each}
					</div>
					{#if next.offer.rules.length && !next.offer.stats.some((s) => s.blocked === null)}
						<p class="note">No characteristic can be raised – choose under {next.offer.rulesLabel}.</p>
					{/if}
					{#if !open}
						<button class="add" onclick={() => choose({})}>Use up this level</button>
					{/if}
				{/if}
			</section>
		</div>
	{:else}
		<div class="parchment">
			<section>
				<label class="heading" for="back-name"><span>Name</span><span class="rule"></span></label>
				<input id="back-name" class="field" type="text" autocomplete="off" {placeholder} bind:value={draft.name} />
			</section>

			<section>
				<h3 class="heading"><span>Photo</span><span class="rule"></span></h3>
				<input bind:this={photoInput} type="file" accept="image/*" hidden onchange={pickPhoto} />
				{#if stored && layout}
					<div
						bind:this={preview}
						class="preview"
						style:background-image={previewUrl ? `url(${previewUrl})` : null}
						style:background-size={layout.size}
						style:background-position={layout.position}
						style:mask-image={imageFieldMask}
						style:-webkit-mask-image={imageFieldMask}
						role="img"
						aria-label="The photo as the card shows it. Drag to move it."
						onpointerdown={startDrag}
						onpointermove={drag}
						onpointerup={endDrag}
						onpointercancel={endDrag}
					></div>
					<div class="zoom">
						<label for="back-zoom">Zoom</label>
						<input
							id="back-zoom"
							type="range"
							min="1"
							max={MAX_ZOOM}
							step="0.05"
							value={stored.crop.zoom}
							oninput={(e) => recrop((c) => zoomCrop(c, e.currentTarget.valueAsNumber))}
						/>
						<button type="button" class="remove" onclick={() => recrop(() => ({ ...CENTRE }))}>Reset</button>
					</div>
					<div class="photo-actions">
						<button type="button" class="add" onclick={() => photoInput?.click()}>Replace photo</button>
						<button type="button" class="remove" onclick={() => (photo = { photo: null, changed: true })}>Remove photo</button>
					</div>
				{:else}
					<div class="photo-row">
						<div class="thumb" role="img" aria-label="No photo chosen"><span>No photo</span></div>
						<div class="photo-actions">
							<button type="button" class="add" onclick={() => photoInput?.click()}>Choose photo</button>
						</div>
					</div>
				{/if}
				{#if photoError}<p class="callout">{photoError}</p>{/if}
				<p class="hint">Photos stay on this device and are not part of the export.</p>
			</section>

			<section>
				<label class="heading" for="back-fluff"><span>Fluff</span><span class="rule"></span></label>
				<textarea id="back-fluff" class="field fluff" rows="2" placeholder="A line or two of story" bind:value={draft.fluff} use:grow
				></textarea>
			</section>

			{#if campaign}
				<!-- As the Warband Deck has it, for what the aftermath did not count: a
				     battle played elsewhere, a point given by mistake. -->
				<section bind:this={campaignSection}>
					<h3 class="heading"><span>Campaign</span><span class="rule"></span></h3>
					{#each campaign.counters as counter (counter.key)}
						{@const value = draft.tally[counter.key] ?? 0}
						<div class="counter">
							<span class="label" id="back-{counter.key}">{counter.label}</span>
							<div class="stepper" role="group" aria-labelledby="back-{counter.key}">
								<button
									class="segment"
									aria-label="Less {counter.label.toLowerCase()}"
									disabled={value <= floorOf(counter.key)}
									onclick={() => step(counter.key, -1)}>−</button
								>
								<output class="figure">{value}</output>
								<button
									class="segment"
									aria-label="More {counter.label.toLowerCase()}"
									disabled={!counter.raise}
									onclick={() => step(counter.key, 1)}>+</button
								>
							</div>
						</div>
						{#if floorOf(counter.key) > 0 && value <= floorOf(counter.key)}
							<p class="hint">Not below a level already spent.</p>
						{/if}
					{/each}

					{#if renown?.spent.length}
						<ul class="list">
							{#each renown.spent as spent, i (i)}
								<li>
									<span class="line">
										<span class="when">{spent.level ? `${renown.label} ${spent.level}` : 'Warband file'}</span>
										{spent.text}
									</span>
									{#if i === renown.spent.length - 1 && spent.level > 0}
										<button class="remove" onclick={undoLast}>Undo</button>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
					{#if renown?.next}
						<button class="add" onclick={() => showSpending(true)}>Spend {renown.label.toLowerCase()} ({renown.waiting})</button>
					{/if}
				</section>
			{/if}

			{#if injuries && (injuries.length || draft.away)}
				<!-- What the aftermath wrote in, to take back a result tapped by mistake,
				     and why the fighter sits out, cleared once it is back. -->
				<section>
					<h3 class="heading"><span>Injuries</span><span class="rule"></span></h3>
					{#if draft.away}
						<ul class="list">
							<li>
								<span class="line">{AWAY_LABELS[draft.away]}</span>
								<button class="remove" onclick={() => (draft.away = null)}>{draft.away === 'captured' ? 'Got back' : 'Clear'}</button>
							</li>
						</ul>
					{/if}
					<ul class="list">
						{#each injuries as injury, i (i)}
							<li>
								<span class="line">{injury}</span>
								<button class="remove" onclick={() => (draft.injuries = draft.injuries.filter((_, j) => j !== i))}>Remove</button>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if lead}
				<!-- Death of a leader: a warband that lost its leader picks one of
				     its fighters to carry the LEADER keyword, here as on the aftermath. -->
				<section>
					<h3 class="heading"><span>Leader</span><span class="rule"></span></h3>
					<p class="note">The warband has no leader. A {lead.keyword} takes the LEADER keyword – only the keyword, not the abilities of the leader's own type.</p>
					<div class="toggles stacked">
						<button class="toggle" aria-pressed={draft.lead} onclick={() => (draft.lead = !draft.lead)}>Lead the warband</button>
						{#if draft.lead && lead.dead.some((d) => d.carried.length)}
							<button class="toggle" aria-pressed={draft.recovered} onclick={() => (draft.recovered = !draft.recovered)}>
								Recovered on a 3+ – {lead.dead.flatMap((d) => d.carried).join(', ')} to the stash
							</button>
						{/if}
					</div>
					{#if draft.lead && lead.dead.length}
						<p class="hint">{lead.dead.map((d) => d.name).join(', ')} leaves the roster with Done.</p>
					{/if}
				</section>
			{/if}

			{#if equipment}
				<!-- As the Warband Deck has it: what the fighter bought goes to the
				     stash and comes back, each piece checked as the builder checks it. -->
				<section>
					<h3 class="heading"><span>Equipment</span><span class="rule"></span></h3>
					{#if equipment.blocked}
						<p class="hint">{equipment.blocked}</p>
					{:else}
						<p class="caption">Carried</p>
						{#if equipment.carried.length}
							<ul class="list">
								{#each equipment.carried as piece, i (i)}
									<li>
										<span class="line">{piece}</span>
										<button class="remove" onclick={() => toStash(i)}>To stash</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="hint">Nothing bought – what the profile brings stays with the fighter.</p>
						{/if}

						<p class="caption">In the stash</p>
						{#if equipment.takesNothing}
							<p class="hint">{equipment.takesNothing}.</p>
						{:else if equipment.stash.length}
							<ul class="list">
								{#each equipment.stash as piece, i (i)}
									<li>
										<span class="line">
											{piece.name}
											{#if piece.refused}<span class="why">{piece.refused}</span>{/if}
										</span>
										<button class="remove" disabled={piece.refused !== null} onclick={() => take(i)}>Take</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="hint">The stash is empty.</p>
						{/if}
						{#if !equipment.takesNothing}
							<a class="buy" href={equipment.buy}>Buy in the builder ›</a>
						{/if}
					{/if}
				</section>
			{/if}

			<section>
				<label class="heading" for="back-notes"><span>Notes</span><span class="rule"></span></label>
				<textarea id="back-notes" class="field" rows="2" placeholder="Anything to remember at the table" bind:value={draft.notes} use:grow
				></textarea>
			</section>

			{#if dismissal}
				<!-- As the Warband Deck has it, last on the back: asked once more in a
				     sheet and written at once, not with Done. -->
				<section>
					<h3 class="heading"><span>Dismiss</span><span class="rule"></span></h3>
					{#if dismissal.blocked}
						<p class="hint">{dismissal.blocked}</p>
					{:else}
						{#if dismissal.carried.length}
							<div class="toggles stacked">
								{#each dismissal.carried as piece, i (i)}
									<button class="toggle" aria-pressed={!leaves.includes(i)} onclick={() => toggleLeaves(i)}>{piece} to the stash</button>
								{/each}
							</div>
						{/if}
						<button class="dismiss" onclick={() => ondismiss(dismissal.carried.map((_, i) => i).filter((i) => !leaves.includes(i)))}
							>Dismiss {name}</button
						>
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</article>

<style>
	.fluff {
		font-style: italic;
	}

	.photo-row {
		display: flex;
		align-items: center;
		gap: calc(12 * var(--u));
	}

	.photo-actions {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: calc(8 * var(--u));
	}

	/* What the image field shows, cut by the same mask. Dragging must not
	   scroll the back along. */
	.preview {
		width: calc(240 * var(--u));
		max-width: 100%;
		aspect-ratio: 1;
		margin: 0 auto;
		background-color: var(--card-green);
		background-repeat: no-repeat;
		mask-size: 100% 100%;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
		touch-action: none;
		cursor: grab;
	}

	.zoom {
		display: flex;
		align-items: center;
		gap: calc(10 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
	}

	.zoom input {
		flex: 1;
		min-width: 0;
		accent-color: var(--card-green);
	}

	/* The empty frame while there is no photo. */
	.thumb {
		flex: none;
		display: grid;
		place-items: center;
		width: calc(96 * var(--u));
		aspect-ratio: 1;
		border: 1px solid var(--card-green);
		background-color: var(--card-field);
		font-family: 'Alegreya', serif;
		font-size: calc(16 * var(--t));
		color: var(--card-ink-muted);
	}


	/* In a row of its own, at the right edge under what it adds to. */
	section > .add {
		align-self: flex-end;
	}

	.when {
		margin-right: 0.3em;
		font-variant-numeric: lining-nums tabular-nums;
	}

	/* The one button on the back that takes something away, in the link's red. */
	.dismiss {
		align-self: flex-end;
		min-height: 40px;
		padding: 0 calc(14 * var(--u));
		border: 1px solid var(--card-link);
		border-radius: var(--card-button-radius);
		background: var(--card-field);
		color: var(--card-link);
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
	}

	.buy {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-link);
	}
</style>
