// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface PageState {
			/** The open explanation overlay, see src/lib/explanation.ts. */
			explanation?: import('$lib/core/card').CardExplanation;
			/** Which opening of the overlay the entry belongs to, see src/lib/explanation.ts. */
			explanationId?: number;
		}
	}

	/** The version from package.json, set at build time (see vite.config.ts). */
	const __APP_VERSION__: string;
}

export {};
