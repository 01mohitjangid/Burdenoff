import 'server-only';
import { NextResponse } from 'next/server';
import { ApiError, toErrorResponse } from './api-error';

/**
 * App Router route handlers have no body size limit of their own, unlike the
 * old Pages API routes. Every request here is a small JSON object, so anything
 * larger is either a mistake or an attempt to make the server do work.
 */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Wraps a route handler so every thrown `ApiError` becomes its JSON response and
 * everything else becomes a generic 500. Without this each handler would need
 * its own try/catch, and the one that forgot would leak a stack trace.
 *
 * It also stamps `Cache-Control: no-store` on every response. This API only ever
 * returns one caller's own data, so nothing in front of it should hold a copy.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    let response: NextResponse;
    try {
      response = await handler(...args);
    } catch (error) {
      response = toErrorResponse(error);
    }

    if (!response.headers.has('Cache-Control')) {
      response.headers.set('Cache-Control', 'no-store');
    }
    return response;
  };
}

/** Reads a JSON body, turning a malformed or oversized one into a 4xx. */
export async function readJsonBody(request: Request): Promise<unknown> {
  requireJsonContentType(request);

  const body = await readBodyUnderLimit(request);

  // An empty body means "no fields", not "malformed". The one-click check-in
  // button has nothing to send, and making it invent `{}` would be a trap.
  if (body.trim().length === 0) return {};

  try {
    return JSON.parse(body);
  } catch {
    throw ApiError.validation('Send a valid JSON body.');
  }
}

/** The second argument Next hands a dynamic route handler. */
export interface RouteContext<Params> {
  params: Promise<Params>;
}

/**
 * A browser will not send `application/json` cross-site without a CORS
 * preflight, so this is a second line of defence behind the SameSite cookie.
 *
 * The essence is compared exactly rather than searched for. CORS decides
 * safelisting on the type/subtype alone and ignores parameters, so a substring
 * test would let `text/plain;x=application/json` through preflight-free —
 * defeating the only thing this check adds.
 */
function requireJsonContentType(request: Request): void {
  const essence = (request.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (essence !== 'application/json') {
    throw ApiError.validation('Send this request as application/json.');
  }
}

/**
 * Reads the body a chunk at a time and gives up the moment it goes over.
 *
 * `request.text()` would buffer the whole thing first, so a size check after it
 * only stops clients that honestly declare `content-length` — an attacker just
 * uses chunked encoding. Reading the stream is what makes the limit real.
 */
async function readBodyUnderLimit(request: Request): Promise<string> {
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > MAX_BODY_BYTES) throw ApiError.payloadTooLarge();
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // A client that hangs up mid-upload is ordinary behaviour, not a server
    // fault. Letting it escape would report a 500 and write a stack trace that
    // looks like a defect — and an attacker could farm those log lines.
    throw ApiError.validation('Could not read the request body.');
  } finally {
    // Cancelling a socket that is already gone rejects. Without this catch that
    // rejection would replace the error above, turning a 413 into a 500 at
    // exactly the moment someone is deliberately sending too much.
    await reader.cancel().catch(() => {});
  }

  // Decode once, after merging. Decoding per chunk would corrupt any multi-byte
  // character that happens to straddle a chunk boundary.
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
