/**
 * Transport-level contract shapes.
 *
 * These mirror the Pydantic models in `server/app/schemas/`. The backend is the
 * source of truth; `npm run gen:api` regenerates a full typed mirror from the
 * live OpenAPI document into `src/generated/api.ts`. The hand-written types
 * below cover only the envelope shapes that are stable by design.
 */

/** Uniform error body returned by the backend's exception handlers. */
export interface ApiError {
  /** Machine-readable, stable across releases. Safe to branch on. */
  code: string;
  /** Human-readable; may change. Never branch on this. */
  message: string;
  /** Correlates a client report with a server log line. */
  requestId: string;
  /** Field-level detail for validation failures. */
  details?: Record<string, string[]>;
}

/** Envelope for list endpoints. Cursor-based to stay correct under writes. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  environment: string;
}
