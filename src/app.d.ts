// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {}

	/** The version from package.json, set at build time (see vite.config.ts). */
	const __APP_VERSION__: string;
}

export {};
