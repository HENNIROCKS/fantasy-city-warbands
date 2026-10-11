<script lang="ts">
	let { onclose }: { onclose: () => void } = $props();

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onclose()} />

<!-- From the foot of the screen, as the other questions are, on whichever page
     the failing write happened. Red: what is built from here on is lost with
     the page. -->
<div class="sheet-backdrop">
	<div class="bottom-sheet" role="alertdialog" aria-modal="true" aria-labelledby="storage-title" aria-describedby="storage-text">
		<h2 id="storage-title">This browser is not keeping your warbands</h2>
		<p id="storage-text" class="notice danger mt-3">
			Export the ones you want to keep, with the arrow beside each on the start page, before you leave.
		</p>
		<div class="sheet-actions">
			<button type="button" class="btn" onclick={onclose} use:focusOnMount>OK</button>
		</div>
	</div>
</div>
