<script lang="ts">
	import { blocks, type MarkupToken } from '$lib/core/markup';

	let { text }: { text: string } = $props();

	const parsed = $derived(blocks(text));
</script>

{#snippet line(tokens: MarkupToken[])}
	{#each tokens as token, i (i)}
		{#if token.kind === 'bold'}
			<strong>{token.value}</strong>
		{:else if token.kind === 'italic'}
			<em>{token.value}</em>
		{:else if token.kind === 'keyword'}
			<span class="text-[0.85em] font-semibold tracking-wide uppercase">{token.value}</span>
		{:else}
			{token.value}
		{/if}
	{/each}
{/snippet}

<span class="block space-y-1">
	{#each parsed as block, b (b)}
		{#if block.kind === 'list'}
			<span class="block space-y-1 pl-4">
				{#each block.lines as item, i (i)}
					<span class="block -indent-3">• {@render line(item)}</span>
				{/each}
			</span>
		{:else}
			<span class="block">{@render line(block.lines[0])}</span>
		{/if}
	{/each}
</span>
