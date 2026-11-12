<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { APP_TITLE, dayOf, seenBuild } from '$lib/app';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { DocBlock, Inline } from '$lib/docs';

	let { data } = $props();

	/*
	 * On What's new, a day from the one the update bar was last dismissed on
	 * is marked New – from that day, not after it, as a day can bring more
	 * than one deploy. Never dismissed, nothing is marked: all of it new says
	 * nothing.
	 */
	let since = $state<Date | null>(null);
	onMount(() => {
		const build = seenBuild();
		const seen = new Date(Number(build));
		if (build && !Number.isNaN(seen.getTime())) since = new Date(seen.getFullYear(), seen.getMonth(), seen.getDate());
	});
	const isNew = (tokens: Inline[]) => {
		const day = data.page.path === 'whats-new' && since ? dayOf(tokens.map((t) => t.value).join('')) : null;
		return !!day && day >= since!;
	};

	/** A guide's page in the app. */
	const hrefOf = (path: string) => resolve('/docs') + (path ? `/${path}` : '');
	const parent = $derived(data.crumbs.length ? hrefOf(data.crumbs[data.crumbs.length - 1].path) : resolve('/info'));

	/* A list of nothing but links is a way on, not a list to read: its items are the page's buttons. */
	const onward = (block: DocBlock) => block.kind === 'list' && block.items.every((item) => item[0]?.kind === 'link');

	const buttonClass =
		'flex min-h-11 flex-col justify-center rounded border border-zinc-700 bg-zinc-800 px-4 py-2 transition hover:bg-zinc-700 focus-visible:bg-zinc-700';
</script>

{#snippet line(tokens: Inline[])}
	{#each tokens as token, i (i)}
		{#if token.kind === 'bold'}
			<strong class="text-zinc-200">{token.value}</strong>
		{:else if token.kind === 'italic'}
			<em>{token.value}</em>
		{:else if token.kind === 'icon'}
			<!-- The app's own icon, from docs/icons/: the guide's own file, so the markup is trusted. -->
			<span class="doc-icon" role="img" aria-label={token.value}>{@html token.svg}</span>
		{:else if token.kind === 'link' && token.to !== undefined}
			<a class="underline" href={hrefOf(token.to)}>{token.value}</a>
		{:else if token.kind === 'link'}
			<a class="underline" href={token.href} target="_blank" rel="noopener">{token.value} <span aria-hidden="true">↗</span></a>
		{:else}
			{token.value}
		{/if}
	{/each}
{/snippet}

{#snippet under(items: Inline[][])}
	{#if items.length}
		<ul class="mt-1 list-[circle] space-y-1 pl-5">
			{#each items as item, i (i)}<li>{@render line(item)}</li>{/each}
		</ul>
	{/if}
{/snippet}

<svelte:head>
	<title>{data.page.title} · Docs · {APP_TITLE}</title>
</svelte:head>

<PageHeader title="Docs" back={parent} />

<main class="mx-auto max-w-2xl space-y-4 p-5 pb-16 text-sm text-zinc-300">
	<nav aria-label="Breadcrumb">
		<ol class="flex flex-wrap items-center gap-x-1.5 text-zinc-400">
			<li><a class="underline" href={resolve('/info')}>Settings</a></li>
			{#each data.crumbs as crumb (crumb.path)}
				<!-- The separator inside the crumb, so the list counts only the crumbs. -->
				<li><span class="mr-1.5" aria-hidden="true">›</span><a class="underline" href={hrefOf(crumb.path)}>{crumb.label}</a></li>
			{/each}
		</ol>
	</nav>

	<!-- The header holds the page's h1, as on every page of the app. -->
	<h2 class="text-xl font-semibold text-zinc-200">{data.page.title}</h2>

	{#each data.page.blocks as block, b (b)}
		{#if block.kind === 'heading'}
			<!-- One level below the title: a file's ## is the page's h3. -->
			<svelte:element this={`h${Math.min(block.level + 1, 6)}`} class="pt-4 text-base font-semibold text-zinc-200"
				>{@render line(block.inline)}{#if isNew(block.inline)}{' '}<span
						class="ml-1 inline-block rounded-full border px-2 align-[2px] text-xs leading-5"
						style="background: var(--ui-sel-bg); border-color: var(--ui-sel-border); color: var(--ui-sel-text)">New</span
					>{/if}</svelte:element
			>
		{:else if block.kind === 'paragraph'}
			<p>{@render line(block.inline)}</p>
		{:else if onward(block)}
			<ul class="space-y-2">
				{#each block.items as item, i (i)}
					{@const [link, ...rest] = item}
					{#if link.kind === 'link'}
						<li>
							<a class={buttonClass} href={link.to !== undefined ? hrefOf(link.to) : link.href}>
								<span class="font-semibold text-zinc-200">{link.value}</span>
								{#if rest.some((t) => t.value.replace(/^\s*–\s*/, '').trim())}
									<span class="text-zinc-400">{rest.map((t) => t.value).join('').replace(/^\s*–\s*/, '')}</span>
								{/if}
							</a>
						</li>
					{/if}
				{/each}
			</ul>
		{:else if block.ordered}
			<ol class="list-decimal space-y-1 pl-5">
				{#each block.items as item, i (i)}<li>{@render line(item)}{@render under(block.under[i])}</li>{/each}
			</ol>
		{:else}
			<ul class="list-disc space-y-1 pl-5">
				{#each block.items as item, i (i)}<li>{@render line(item)}{@render under(block.under[i])}</li>{/each}
			</ul>
		{/if}
	{/each}

	<a
		class="block rounded bg-[#125E3C] px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
		href={resolve('/')}>Back to your warbands</a
	>
</main>

<style>
	/* As large as the type, sitting on its line; the preflight would make it a block. */
	.doc-icon :global(svg) {
		display: inline;
		width: 1.15em;
		height: 1.15em;
		vertical-align: -0.2em;
	}
</style>
