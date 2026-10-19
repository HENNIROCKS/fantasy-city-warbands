import { error } from '@sveltejs/kit';
import { docPage, docPaths } from '$lib/docs';
import type { EntryGenerator, PageLoad } from './$types';

/* Nothing links here that the build could follow – the pages render in the
   browser – so every guide is named for it. */
export const entries: EntryGenerator = () => docPaths().map((path) => ({ path }));

export const load: PageLoad = ({ params }) => {
	const page = docPage(params.path);
	if (!page) error(404, 'No such guide');
	/* The guides above this one, by their paths: the start of the guides, then the game's. */
	const parts = page.path ? page.path.split('/') : [];
	const above = parts.length ? ['', ...parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))] : [];
	const crumbs = above.map((path) => ({ path, label: path ? (docPage(path)?.title ?? path) : 'Docs' }));
	return { page, crumbs };
};
