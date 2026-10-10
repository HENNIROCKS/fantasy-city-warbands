import { readFileSync } from 'node:fs';

import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/* The about page names the version. Reading it from package.json keeps the
   number in one place instead of a second copy in the markup. */
const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version)
	},
	plugins: [tailwindcss(), sveltekit()]
});
