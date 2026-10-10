<script lang="ts">
	import { updated } from '$app/state';

	/*
	 * Offers a newer deploy once SvelteKit has found one. It polls on its own
	 * (svelte.config.js), but a timer does not run while the app is in the
	 * background, so coming back to it checks at once.
	 */
	$effect(() => {
		const check = () => {
			if (document.visibilityState === 'visible') updated.check();
		};
		document.addEventListener('visibilitychange', check);
		return () => document.removeEventListener('visibilitychange', check);
	});
</script>

{#if updated.current}
	<!-- Over the header rather than under it: the builder's footer and the card
	     stack take the foot of the screen. Reloading asks the server again
	     instead of taking the page from the cache. -->
	<div
		class="fixed inset-x-0 top-0 z-40 border-b border-zinc-700 bg-zinc-800 text-sm"
		style="padding-top: env(safe-area-inset-top)"
		role="status"
	>
		<div class="mx-auto flex max-w-2xl items-center gap-3 px-5 py-1">
			<span class="min-w-0 flex-1 text-zinc-200">A new version is available.</span>
			<button
				type="button"
				class="min-h-11 rounded bg-[#125E3C] px-4 font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
				onclick={() => location.reload()}>Reload</button
			>
		</div>
	</div>
{/if}
