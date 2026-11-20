/** Workspace reference data (departments, positions, leave policy, settings) that changes rarely and is refreshed by the mutations that edit it. */
export const REFERENCE_DATA_STALE_MS = 5 * 60_000;

/** Catalogues that are effectively static for a session (plans, holiday countries). */
export const CATALOG_STALE_MS = 30 * 60_000;
