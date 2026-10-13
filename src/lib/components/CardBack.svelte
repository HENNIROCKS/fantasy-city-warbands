<script lang="ts" module>
	import type { StoredPhoto } from '$lib/photo';

	/** What the back of a fighter's card writes with Done. */
	export interface BackDraft {
		fluff: string;
		notes: string;
		xp: number;
		/** The game's campaign counters for the fighter, such as renown, by key. */
		tally: Record<string, number>;
		/** What the fighter has bought, as stored – what its profile brings is not in here. */
		wargear: string[];
		/** The warband's stash, which the fighter hands pieces to and takes them from. */
		stash: string[];
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

	/** What the game's campaign lets the back correct by hand; null where it keeps none. */
	export interface BackCampaign {
		/** False for a fighter that never earns experience, such as a BEAST. */
		xp: boolean;
		/** One more point of experience, with whatever level it brings. */
		addXp: (xp: number, tally: Record<string, number>) => { xp: number; tally: Record<string, number> };
		/**
		 * `floor` is the lowest the counter may go: no level already spent is
		 * taken away. Without `raise` it only comes down, for a fighter that
		 * never gains it and has some from a file.
		 */
		counters: { key: string; label: string; floor: number; raise: boolean }[];
	}

	/** The fighter's photo as it stands on the back; `changed` says whether Done has to write it. */
	export interface BackPhoto {
		photo: StoredPhoto | null;
		changed: boolean;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
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
		draft = $bindable(),
		photo = $bindable(),
		campaign,
		equipment
	}: {
		name: string;
		draft: BackDraft;
		photo: BackPhoto;
		campaign: BackCampaign | null;
		equipment: BackEquipment | null;
	} = $props();

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

	function moreXp() {
		if (!campaign) return;
		({ xp: draft.xp, tally: draft.tally } = campaign.addXp(draft.xp, draft.tally));
	}

	function step(key: string, by: number) {
		draft.tally = { ...draft.tally, [key]: (draft.tally[key] ?? 0) + by };
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

<article class="card back">
	<h2 class="name">{name}</h2>

	<div class="parchment">
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
			<textarea id="back-fluff" class="fluff" rows="2" placeholder="A line or two of story" bind:value={draft.fluff} use:grow
			></textarea>
		</section>

		{#if campaign}
			<!-- As the Warband Deck has it, for what the aftermath did not count: a
			     battle played elsewhere, a point given by mistake. -->
			<section>
				<h3 class="heading"><span>Campaign</span><span class="rule"></span></h3>
				{#if campaign.xp}
					<div class="counter">
						<span class="label" id="back-xp">Experience Points</span>
						<div class="toggles" role="group" aria-labelledby="back-xp">
							<button class="toggle" aria-label="Less experience" disabled={draft.xp <= 0} onclick={() => (draft.xp -= 1)}>−</button>
							<output class="count">{draft.xp}</output>
							<button class="toggle" aria-label="More experience" onclick={moreXp}>+</button>
						</div>
					</div>
				{/if}
				{#each campaign.counters as counter (counter.key)}
					{@const value = draft.tally[counter.key] ?? 0}
					<div class="counter">
						<span class="label" id="back-{counter.key}">{counter.label}</span>
						<div class="toggles" role="group" aria-labelledby="back-{counter.key}">
							<button
								class="toggle"
								aria-label="Less {counter.label.toLowerCase()}"
								disabled={value <= Math.max(0, counter.floor)}
								onclick={() => step(counter.key, -1)}>−</button
							>
							<output class="count">{value}</output>
							<button
								class="toggle"
								aria-label="More {counter.label.toLowerCase()}"
								disabled={!counter.raise}
								onclick={() => step(counter.key, 1)}>+</button
							>
						</div>
					</div>
					{#if counter.floor > 0 && value <= counter.floor}
						<p class="hint">Not below a level already spent.</p>
					{/if}
				{/each}
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
			<textarea id="back-notes" rows="2" placeholder="Anything to remember at the table" bind:value={draft.notes} use:grow
			></textarea>
		</section>
	</div>
</article>

<style>
	/* A lighter patch of the paper rather than a box: no frame and no line,
	   brighter and edged in green while the field is being written in. */
	textarea {
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
		resize: none;
		overflow: hidden;
	}

	textarea:focus {
		background: rgb(255 255 255 / 0.7);
		box-shadow: inset 0 0 0 1px var(--card-green);
	}

	::placeholder {
		color: var(--card-ink-muted);
		font-style: italic;
	}

	.fluff {
		font-style: italic;
	}

	/* The figure's name on the left, its steps on the right. */
	.counter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(12 * var(--u));
	}

	.counter .label {
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-ink);
	}

	.counter .toggles {
		flex-wrap: nowrap;
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
