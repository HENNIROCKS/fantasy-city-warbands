<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_TITLE } from '$lib/app';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { DocBlock, Inline } from '$lib/docs';

	let { data } = $props();

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
		{:else if token.kind === 'link' && token.to !== undefined}
			<a class="underline" href={hrefOf(token.to)}>{token.value}</a>
		{:else if token.kind === 'link'}
			<a class="underline" href={token.href} target="_blank" rel="noopener">{token.value} <span aria-hidden="true">↗</span></a>
		{:else}
			{token.value}
		{/if}
	{/each}
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
				<li aria-hidden="true">›</li>
				<li><a class="underline" href={hrefOf(crumb.path)}>{crumb.label}</a></li>
			{/each}
		</ol>
	</nav>

	<!-- The header holds the page's h1, as on every page of the app. -->
	<h2 class="text-xl font-semibold text-zinc-200">{data.page.title}</h2>

	{#each data.page.blocks as block, b (b)}
		{#if block.kind === 'heading'}
			<!-- One level below the title: a file's ## is the page's h3. -->
			<svelte:element this={`h${Math.min(block.level + 1, 6)}`} class="pt-4 text-base font-semibold text-zinc-200">{@render line(block.inline)}</svelte:element>
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
				{#each block.items as item, i (i)}<li>{@render line(item)}</li>{/each}
			</ol>
		{:else}
			<ul class="list-disc space-y-1 pl-5">
				{#each block.items as item, i (i)}<li>{@render line(item)}</li>{/each}
			</ul>
		{/if}
	{/each}
</main>
