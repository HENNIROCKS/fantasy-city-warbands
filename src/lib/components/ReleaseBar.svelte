<script lang="ts">
	import { onMount } from 'svelte';
	import { version } from '$app/environment';
	import { BUILD_DATE, REPO } from '$lib/app';

	/* The build the bar was dismissed for; a new deploy brings it back. */
	const KEY = 'fantasy-city-warbands:seen-update';

	/*
	 * Shown only once mounted: the prerendered page cannot know what this
	 * browser dismissed, and a bar that vanishes on load is worse than one that
	 * appears. Where storage is blocked, dismissing holds for the visit.
	 */
	let open = $state(false);

	onMount(() => {
		try {
			open = localStorage.getItem(KEY) !== version;
		} catch {
			open = true;
		}
	});

	function dismiss() {
		open = false;
		try {
			localStorage.setItem(KEY, version);
		} catch {
			/* Gone for this visit only. */
		}
	}
</script>

{#if open && BUILD_DATE}
	<!-- Green as the app's own colour, not a signal: nothing here asks for action. -->
	<div class="border-b text-sm" style="background: var(--ui-sel-bg); border-color: var(--ui-sel-border); color: var(--ui-sel-text)">
		<div class="mx-auto flex max-w-2xl items-center gap-2 py-0.5 pr-1 pl-5">
			<p class="min-w-0 flex-1">
				Updated {BUILD_DATE} ·
				<a class="underline underline-offset-2" href="{REPO}/blob/main/ROADMAP.md" target="_blank" rel="noopener"
					>What’s new <span aria-hidden="true">↗</span></a
				>
			</p>
			<button
				type="button"
				class="flex size-11 shrink-0 items-center justify-center rounded text-lg transition hover:bg-[var(--ui-sel-border)] focus-visible:bg-[var(--ui-sel-border)]"
				aria-label="Dismiss"
				onclick={dismiss}>×</button
			>
		</div>
	</div>
{/if}
