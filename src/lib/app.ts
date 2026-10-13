import { version } from '$app/environment';

/** The app's name, as the header and the browser tab show it. */
export const APP_NAME = 'Fantasy City Warbands';

/**
 * How far along the app is, shown beside its name wherever that appears.
 * Null once there is nothing left to warn about.
 */
export const STAGE: string | null = 'Early';

/** The name with its stage, for the browser tab. */
export const APP_TITLE = STAGE ? `${APP_NAME} (${STAGE})` : APP_NAME;

/** Where the app's code, roadmap and issues live. */
export const REPO = 'https://github.com/HENNIROCKS/fantasy-city-warbands';

/*
 * `version` from SvelteKit is the timestamp of the build. It answers whether
 * the page is today's state, which a version number that stands still for
 * months cannot. Spelled out rather than left to toLocaleDateString, whose
 * month abbreviations differ between engines.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const built = new Date(Number(version));

/** The day this build was made, such as `13 Oct 2026`; null where the version is not a timestamp. */
export const BUILD_DATE = Number.isNaN(built.getTime())
	? null
	: `${built.getDate()} ${MONTHS[built.getMonth()]} ${built.getFullYear()}`;
