/**
 * Validated view of the build-time environment.
 *
 * Vite inlines `import.meta.env` at build time, so anything read here ships to
 * the browser. Never put a secret in a VITE_ variable. Validation happens once,
 * at module load, so a misconfigured deploy fails immediately and loudly rather
 * than at the first network call.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  apiBaseUrl: required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL),
  environment: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
} as const;
