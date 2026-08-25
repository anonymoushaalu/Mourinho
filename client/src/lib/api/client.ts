import { API_V1_PREFIX, type ApiError } from '@mourinho/shared';

import { env } from '@/config/env';

/** Thrown for any non-2xx response. Carries the server's structured error. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(body.message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Single choke point for backend traffic.
 *
 * Every call goes through here so auth headers, error normalisation, tracing
 * and timeouts are added in one place rather than scattered across features.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${env.apiBaseUrl}${API_V1_PREFIX}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const fallback: ApiError = {
      code: 'unknown_error',
      message: response.statusText,
      requestId: response.headers.get('x-request-id') ?? '',
    };
    const parsed = (await response.json().catch(() => fallback)) as ApiError;
    throw new ApiRequestError(response.status, parsed);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
