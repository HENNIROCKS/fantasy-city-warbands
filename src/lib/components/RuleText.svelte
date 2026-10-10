<script lang="ts">
	import { blocks, type MarkupToken } from '$lib/core/markup';

	let { text }: { text: string } = $props();

	const parsed = $derived(blocks(text));
</script>

<!-- A rules text inside a card's paragraph. Spans rather than <ul>: it sits in a
     <p>, and a list element there would break the page apart when parsed. The
     paragraph keeps the text's own whitespace, so paragraphs part on a written
     line break and the template is kept on one line – a break in it would show
     up on the card. -->
{#snippet inline(tokens: MarkupToken[])}{#each tokens as token, i (i)}{#if token.kind === 'bold'}<strong>{token.value}</strong>{:else if token.kind === 'italic'}<em>{token.value}</em>{:else if token.kind === 'keyword'}<span class="keyword">{token.value}</span>{:else}{token.value}{/if}{/each}{/snippet}{#each parsed as block, b (b)}{#if block.kind === 'list'}<span class="rule-list" role="list">{#each block.lines as item, i (i)}<span class="rule-item" role="listitem">{@render inline(item)}</span>{/each}</span>{:else}{#if b > 0 && parsed[b - 1].kind === 'paragraph'}{'\n'}{/if}{@render inline(block.lines[0])}{/if}{/each}
