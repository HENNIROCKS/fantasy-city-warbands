import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		}),
		paths: {
			/* GitHub Pages serves the app from /<repo>/, so every link between routes
			   carries that prefix. The deploy workflow sets it; locally it is empty
			   and the dev server stays at the root. */
			base: process.env.BASE_PATH ?? ''
		},
		/* A deploy is noticed while the app is open, so UpdateBar can offer the new
		   version: the home screen app on iOS comes back from the background
		   rather than loading again, and keeps showing the old one otherwise. */
		version: {
			pollInterval: 60_000
		}
	}
};

export default config;
