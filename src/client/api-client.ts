import 'client-only';
import type { ApiErrorCode, ApiErrorResponse, FieldErrors } from '@/lib/api-contract';

/**
 * An error the API returned on purpose, carried to the UI intact.
 *
 * `code` lets a component react to a specific case — showing "already done
 * today" differently from a generic failure — and `fields` lets a form put a
 * message under the input it belongs to.
 */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: FieldErrors
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/**
 * One place that talks to the API.
 *
 * Three things every caller would otherwise have to remember:
 *
 *   - the JSON content type, which the API requires and `fetch` does not send
 *     by default for a string body;
 *   - that a 204 has no body at all, so parsing it would throw;
 *   - that a failure should arrive as a typed error rather than as a response
 *     object the caller has to remember to check.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const response = await fetch(path, {
    method,
    // Always sent, even with no body. The API rejects anything else, and this
    // is the single easiest thing to forget at a call site.
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) throw await toClientError(response);

  // 204 means there is deliberately nothing to read.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function toClientError(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    if (body?.error?.code) {
      return new ApiClientError(
        response.status,
        body.error.code,
        body.error.message,
        body.error.fields
      );
    }
  } catch {
    // A gateway timeout or a crash returns HTML, not our error shape. Falling
    // through gives the user a readable message instead of a parse error.
  }

  return new ApiClientError(
    response.status,
    'INTERNAL_ERROR',
    'Something went wrong. Please try again.'
  );
}

/** The message to show a user for anything that was thrown. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Something went wrong. Please try again.';
}

/** The per-field messages to show, if the error carries any. */
export function fieldsFor(error: unknown): FieldErrors {
  return error instanceof ApiClientError ? (error.fields ?? {}) : {};
}
