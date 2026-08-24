import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { ApiErrorCode, ApiErrorResponse, FieldErrors } from '@/lib/api-contract';

/**
 * An error that is safe to show the caller.
 *
 * Anything thrown that is NOT an `ApiError` is treated as a bug and reported as
 * a generic 500, so an unexpected database or driver message can never reach a
 * client.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: FieldErrors
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static validation(message: string, fields?: FieldErrors): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', message, fields);
  }

  static unauthenticated(message = 'You need to log in to do that.'): ApiError {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }

  static invalidCredentials(): ApiError {
    // Deliberately identical whether the email is unknown or the password is
    // wrong. A different message for each would confirm which emails exist.
    return new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  static emailTaken(): ApiError {
    return new ApiError(409, 'EMAIL_TAKEN', 'An account with that email already exists.');
  }

  static notFound(message = 'Not found.'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static payloadTooLarge(): ApiError {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'That request body is too large.');
  }
}

/** Flattens a Zod failure into `{ field: [messages] }`. */
export function fieldErrorsFrom(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/** Turns anything thrown inside a route handler into a JSON response. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return errorBody(
      ApiError.validation('Please correct the errors below.', fieldErrorsFrom(error))
    );
  }

  if (error instanceof ApiError) {
    return errorBody(error);
  }

  // Unexpected: log the real cause for us, return nothing useful to the caller.
  console.error('Unhandled route error', error);
  return errorBody(
    new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')
  );
}

function errorBody(error: ApiError): NextResponse {
  const body: ApiErrorResponse = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
  };
  return NextResponse.json(body, { status: error.status });
}
