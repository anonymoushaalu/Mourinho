/**
 * Validated view of the build-time environment.
 *
 * Vite inlines `import.meta.env` at build time, so anything read here ships to
 * the browser. Never put a secret in a VITE_ variable. Validation happens once,
 * at module load, so a misconfigured deploy fails immediately and loudly rather
 * than at the first network call.
 */

export const env = {
  // Empty string means "same-origin via Vite proxy in dev, same-origin in prod"
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  environment: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
  useMockTransport: import.meta.env.VITE_USE_MOCK_TRANSPORT === 'true',
} as const;
