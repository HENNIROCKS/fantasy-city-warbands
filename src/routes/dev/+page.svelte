<script lang="ts">
	import { dev } from '$app/environment';
	import { resolve } from '$app/paths';
	import { qr, url } from 'virtual:dev-network';
	import { APP_TITLE } from '$lib/app';
	import PageHeader from '$lib/components/PageHeader.svelte';

	/*
	 * The way from the dev server to the phone: its address on the network as a
	 * QR code. `make dev` opens it. Built along with the app, where it has
	 * nothing to show.
	 */
	const insecure = $derived(url !== null && !url.startsWith('https://'));
</script>

<svelte:head>
	<title>Open on your phone · {APP_TITLE}</title>
</svelte:head>

<PageHeader title="Open on your phone" />

<main class="mx-auto flex max-w-2xl flex-col items-center gap-4 p-5 pb-16 text-center text-sm text-zinc-300">
	{#if !dev}
		<p class="text-zinc-400">This page only exists in development mode.</p>
	{:else if !url}
		<p class="max-w-[40ch] text-zinc-400">
			No network address found. Is this machine on Wi-Fi? Is the server running with
			<code>make dev</code>?
		</p>
	{:else}
		<!-- White whatever the theme: a camera reads dark modules on a light field. -->
		<div class="qr">
			<!-- The SVG comes from the Vite config, not from user input. -->
			{@html qr}
		</div>

		<p><a class="font-mono text-base text-zinc-200 underline" href={url}>{url}</a></p>

		<p class="max-w-[40ch] text-zinc-400">
			Point the camera at the code. Phone and machine have to be on the same network.
		</p>

		{#if insecure}
			<div
				class="max-w-[44ch] space-y-2 rounded-md border p-3 text-left"
				style="background: var(--ui-warn-bg); border-color: var(--ui-warn-border); color: var(--ui-warn-text)"
			>
				<p>
					<strong>Over <code>http://</code> this is not an installable app.</strong>
					Layout, swiping and tap targets can be checked this way. What cannot:
				</p>
				<ul class="list-disc pl-5">
					<li>installing to the home screen</li>
					<li>the share sheet for an export or a roster – it falls back to a download</li>
				</ul>
				<p>Both require a secure context, which only HTTPS and localhost provide.</p>
			</div>
		{/if}
	{/if}

	<a
		class="mt-2 block rounded bg-[#125E3C] px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
		href={resolve('/')}>Back to your warbands</a
	>
</main>

<style>
	.qr {
		width: 240px;
		max-width: 100%;
		padding: 12px;
		border-radius: 12px;
		background: #fff;
		line-height: 0;
	}

	.qr :global(svg) {
		width: 100%;
		height: auto;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.92em;
	}
</style>
