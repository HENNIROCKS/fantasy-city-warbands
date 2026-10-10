/**
 * The rules texts carry a little Markdown: `**bold**` and `*italic*` for
 * emphasis, backticks around keywords, and lines opening with "- " as a list.
 * Split into tokens rather than turned into HTML, so nothing needs `{@html}`.
 */

export interface MarkupToken {
	kind: 'text' | 'bold' | 'italic' | 'keyword';
	value: string;
}

export interface MarkupBlock {
	kind: 'paragraph' | 'list';
	/** One entry for a paragraph, one per item for a list. */
	lines: MarkupToken[][];
}

/*
 * Bold before italic, or `**bold**` would read as an empty emphasis. Italic
 * refuses a space inside its stars, as Markdown does, so "2 * 3 * 4" stays text.
 * Neither runs past a line end.
 */
const PATTERN = /\*\*([^\n]+?)\*\*|\*(?!\*)(?!\s)([^*\n]*[^*\s\n])\*|`([^`]+)`/g;

export function tokenize(text: string): MarkupToken[] {
	const tokens: MarkupToken[] = [];
	let last = 0;
	for (const match of text.matchAll(PATTERN)) {
		if (match.index > last) tokens.push({ kind: 'text', value: text.slice(last, match.index) });
		if (match[1] !== undefined) tokens.push({ kind: 'bold', value: match[1] });
		else if (match[2] !== undefined) tokens.push({ kind: 'italic', value: match[2] });
		else tokens.push({ kind: 'keyword', value: match[3] });
		last = match.index + match[0].length;
	}
	if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) });
	return tokens;
}

/** Paragraphs and lists, in order. Blank lines only separate. */
export function blocks(text: string): MarkupBlock[] {
	const result: MarkupBlock[] = [];
	for (const raw of text.split('\n')) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith('- ')) {
			const previous = result.at(-1);
			const item = tokenize(line.slice(2));
			if (previous?.kind === 'list') previous.lines.push(item);
			else result.push({ kind: 'list', lines: [item] });
		} else {
			result.push({ kind: 'paragraph', lines: [tokenize(line)] });
		}
	}
	return result;
}
