/** The app's name, as the header and the browser tab show it. */
export const APP_NAME = 'Fantasy City Warbands';

/**
 * How far along the app is, shown beside its name wherever that appears.
 * Null once there is nothing left to warn about.
 */
export const STAGE: string | null = 'Early';

/** The name with its stage, for the browser tab. */
export const APP_TITLE = STAGE ? `${APP_NAME} (${STAGE})` : APP_NAME;
