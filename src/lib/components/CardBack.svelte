<script lang="ts" module>
	import type { StoredPhoto } from '$lib/photo';

	/** What the back of a fighter's card writes with Done. */
	export interface BackDraft {
		fluff: string;
		notes: string;
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
		photo = $bindable()
	}: {
		name: string;
		draft: BackDraft;
		photo: BackPhoto;
	} = $props();

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

		<section>
			<label class="heading" for="back-notes"><span>Notes</span><span class="rule"></span></label>
			<textarea id="back-notes" rows="2" placeholder="Anything to remember at the table" bind:value={draft.notes} use:grow
			></textarea>
		</section>
	</div>
</article>

<style>
	/* Clear of the strokes that mark the place in the stack across the top. */
	.name {
		margin: 0;
		padding: calc(44 * var(--u)) calc(30 * var(--u)) 0;
		text-align: center;
		font-family: 'Grenze Gotisch', serif;
		font-weight: 600;
		font-size: calc(34 * var(--t));
		line-height: 1.1;
		color: #000;
		overflow-wrap: anywhere;
	}

	.parchment {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: calc(66 * var(--u));
		padding: calc(18 * var(--u)) calc(30 * var(--u)) calc(38 * var(--u));
	}

	section {
		display: flex;
		flex-direction: column;
		gap: calc(10 * var(--u));
	}

	.heading {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--t));
		margin: 0;
		padding: calc(4 * var(--t)) 0;
		font-family: 'Grenze Gotisch', serif;
		font-weight: 400;
		font-size: calc(18 * var(--t));
		line-height: 1;
		letter-spacing: 0.04em;
		color: #000;
	}

	.rule {
		flex: 1;
		height: 2px;
		background: #000;
	}

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

	.hint {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		font-style: italic;
		color: var(--card-ink-muted);
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

	.add {
		min-height: 40px;
		padding: 0 calc(14 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: 999px;
		background: var(--card-green);
		color: var(--card-paper);
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
	}

	.remove {
		flex: none;
		min-height: 40px;
		padding: 0 calc(6 * var(--u));
		border: 0;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-link);
	}
</style>
