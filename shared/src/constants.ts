/** Values that must not drift between client and server. */

/** Versioned API prefix. Mirrors `settings.api_v1_prefix` on the backend. */
export const API_V1_PREFIX = '/api/v1' as const;

/** Health probe path, used by the client boot check and by container probes. */
export const HEALTH_PATH = '/health' as const;

export const APP_NAME = 'Mourinho' as const;
