import { version } from '$app/environment';
import { MONTHS } from '$lib/core/history';

/** The app's name, as the header and the browser tab show it. */
export const APP_NAME = 'Fantasy City Warbands';

/**
 * How far along the app is, shown beside its name wherever that appears.
 * Null once there is nothing left to warn about.
 */
export const STAGE: string | null = 'Early';

/** The name with its stage, for the browser tab. */
export const APP_TITLE = STAGE ? `${APP_NAME} (${STAGE})` : APP_NAME;

/** The domain alone, as the label of a game's link. */
export const domain = (url: string) => new URL(url).hostname.replace(/^www\./, '');

/** Where the app's code, roadmap and issues live. */
export const REPO = 'https://github.com/HENNIROCKS/fantasy-city-warbands';

/*
 * `version` from SvelteKit is the timestamp of the build. It answers whether
 * the page is today's state, which a version number that stands still for
 * months cannot. Spelled out rather than left to toLocaleDateString, whose
 * month abbreviations differ between engines.
 */
const built = new Date(Number(version));

/** The day this build was made, such as `13 Oct 2026`; null where the version is not a timestamp. */
export const BUILD_DATE = Number.isNaN(built.getTime())
	? null
	: `${built.getDate()} ${MONTHS[built.getMonth()]} ${built.getFullYear()}`;

/** The day a heading such as `13 Oct 2026` names, at midnight; null for any other text. */
export function dayOf(text: string): Date | null {
	const match = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(text.trim());
	const month = match ? MONTHS.indexOf(match[2]) : -1;
	return match && month >= 0 ? new Date(Number(match[3]), month, Number(match[1])) : null;
}

/* The build the update bar was dismissed for; a new deploy brings it back. */
export const SEEN_KEY = 'fantasy-city-warbands:seen-update';

/** The build the update bar was last dismissed for; null where it never was or storage is blocked. */
export function seenBuild(): string | null {
	try {
		return localStorage.getItem(SEEN_KEY);
	} catch {
		return null;
	}
}
