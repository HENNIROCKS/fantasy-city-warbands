/**
 * The guides under `docs/`, read into the build so the app shows them offline
 * and GitHub shows the same files. Only the little of Markdown they use is
 * read: headings, paragraphs, lists, bold, italic, code, links and images. A
 * link to another guide becomes the path of its page in the app; an image is
 * one of the app's icons from `docs/icons/`, set into the text as markup so it
 * takes the text's colour.
 */

const sources = import.meta.glob('/docs/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const icons = import.meta.glob('/docs/icons/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export type Inline =
	| { kind: 'text' | 'bold' | 'italic'; value: string }
	/** `to` is a guide's path, as `docPage` takes it; `href` an address outside the guides. */
	| { kind: 'link'; value: string; to?: string; href?: string }
	/** `value` is the image's alt text, `svg` the icon's markup. */
	| { kind: 'icon'; value: string; svg: string };

export type DocBlock =
	| { kind: 'heading'; level: number; inline: Inline[] }
	| { kind: 'paragraph'; inline: Inline[] }
	| { kind: 'list'; ordered: boolean; items: Inline[][] };

export interface DocPage {
	/** `''` for the guides' own start, `wyrdcry` for a game's, `wyrdcry/hired-swords` for a topic. */
	path: string;
	title: string;
	/** Everything under the title. */
	blocks: DocBlock[];
}

/** `/docs/wyrdcry/README.md` → `wyrdcry`, `/docs/files-and-roster.md` → `files-and-roster`. */
function pathOf(file: string): string {
	return file
		.replace(/^\/docs\/?/, '')
		.replace(/(^|\/)README\.md$/, '')
		.replace(/\.md$/, '');
}

/** `target` written in `file`, resolved against its folder: `/docs/icons/star.svg`. */
function resolved(file: string, target: string): string {
	const parts = file.split('/').slice(0, -1);
	for (const part of target.split('/')) {
		if (part === '..') parts.pop();
		else if (part !== '.') parts.push(part);
	}
	return parts.join('/');
}

/**
 * A link written in `file`, resolved against its folder, as the path of the
 * guide it points to; null for an address outside the guides, undefined for
 * a guide that does not exist.
 */
function linked(file: string, target: string): string | null | undefined {
	if (/^[a-z]+:/i.test(target) || !target.endsWith('.md')) return null;
	const path = resolved(file, target);
	if (path in sources) return pathOf(path);
	if (import.meta.env.DEV) console.warn(`docs: ${file} links to ${target}, which is not there`);
	return undefined;
}

const INLINE = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

function inline(file: string, text: string): Inline[] {
	const tokens: Inline[] = [];
	let at = 0;
	for (const match of text.matchAll(INLINE)) {
		if (match.index > at) tokens.push({ kind: 'text', value: text.slice(at, match.index) });
		const [, alt, source, label, target, bold, italic, code] = match;
		if (alt !== undefined) {
			const svg = icons[resolved(file, source)];
			if (svg) tokens.push({ kind: 'icon', value: alt, svg });
			else {
				if (import.meta.env.DEV) console.warn(`docs: ${file} shows ${source}, which is not an icon in docs/icons/`);
				tokens.push({ kind: 'text', value: alt });
			}
		} else if (label !== undefined) {
			const to = linked(file, target);
			/* A link to a guide that is not there is left as its text. */
			if (to === undefined) tokens.push({ kind: 'text', value: label });
			else tokens.push(to !== null ? { kind: 'link', value: label, to } : { kind: 'link', value: label, href: target });
		} else if (bold !== undefined) tokens.push({ kind: 'bold', value: bold });
		else if (italic !== undefined) tokens.push({ kind: 'italic', value: italic });
		else tokens.push({ kind: 'text', value: code });
		at = match.index + match[0].length;
	}
	if (at < text.length) tokens.push({ kind: 'text', value: text.slice(at) });
	return tokens;
}

const ITEM = /^(-|\d+\.)\s+/;

function parse(file: string, source: string): { title: string; blocks: DocBlock[] } {
	let title = '';
	const blocks: DocBlock[] = [];
	for (const chunk of source.trim().split(/\n\s*\n/)) {
		const lines = chunk.split('\n');
		const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
		if (heading) {
			if (heading[1].length === 1 && !title) title = heading[2];
			else blocks.push({ kind: 'heading', level: heading[1].length, inline: inline(file, heading[2]) });
			continue;
		}
		if (ITEM.test(lines[0])) {
			/* A line that starts no item carries on the one before it. */
			const items: string[] = [];
			for (const line of lines) {
				if (ITEM.test(line)) items.push(line.replace(ITEM, ''));
				else items[items.length - 1] += ' ' + line.trim();
			}
			blocks.push({ kind: 'list', ordered: /^\d/.test(lines[0]), items: items.map((item) => inline(file, item)) });
			continue;
		}
		blocks.push({ kind: 'paragraph', inline: inline(file, lines.map((l) => l.trim()).join(' ')) });
	}
	return { title, blocks };
}

const pages = new Map(
	Object.entries(sources).map(([file, source]) => {
		const path = pathOf(file);
		return [path, { path, ...parse(file, source) } satisfies DocPage];
	})
);

/** The guide at `path`, or undefined where there is none. */
export function docPage(path: string): DocPage | undefined {
	return pages.get(path.replace(/\/$/, ''));
}

/** Every guide's path, for the build to render each one. */
export function docPaths(): string[] {
	return [...pages.keys()];
}
