import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error';
import { readJsonBody } from './handler';

function jsonRequest(body: string, contentType = 'application/json'): Request {
  return new Request('https://example.test/api/thing', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function streamRequest(body: ReadableStream<Uint8Array>): Request {
  return new Request('https://example.test/api/thing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    // Required by undici when the body is a stream.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

async function statusOf(request: Request): Promise<number> {
  try {
    await readJsonBody(request);
    return 200;
  } catch (error) {
    return error instanceof ApiError ? error.status : 500;
  }
}

describe('readJsonBody', () => {
  it('parses a well-formed body', async () => {
    const parsed = await readJsonBody(jsonRequest('{"email":"a@b.co"}'));
    expect(parsed).toEqual({ email: 'a@b.co' });
  });

  it('accepts a charset parameter and any casing', async () => {
    // MIME types are case-insensitive, and a charset parameter is normal.
    await expect(
      readJsonBody(jsonRequest('{"ok":true}', 'APPLICATION/JSON; charset=utf-8'))
    ).resolves.toEqual({ ok: true });
  });

  it('rejects a body that is not declared as JSON', async () => {
    // This is what fetch() sends for a string body with no explicit header.
    expect(await statusOf(jsonRequest('{"ok":true}', 'text/plain;charset=UTF-8'))).toBe(
      400
    );
    expect(await statusOf(jsonRequest('{"ok":true}', ''))).toBe(400);
  });

  it('is not fooled by the JSON type hidden in a parameter', async () => {
    // A substring check would let this through, and it is CORS-safelisted, so
    // it would skip the preflight this check exists to force.
    expect(
      await statusOf(jsonRequest('{"ok":true}', 'text/plain;x=application/json'))
    ).toBe(400);
    expect(
      await statusOf(
        jsonRequest('{"ok":true}', 'multipart/form-data; boundary=application/json')
      )
    ).toBe(400);
  });

  it('rejects a malformed body as a 400, not a crash', async () => {
    expect(await statusOf(jsonRequest('{not json'))).toBe(400);
    expect(await statusOf(jsonRequest(''))).toBe(400);
  });

  it('rejects an oversized body with 413', async () => {
    const huge = JSON.stringify({ password: 'x'.repeat(64 * 1024) });
    expect(await statusOf(jsonRequest(huge))).toBe(413);
  });

  it('keeps a multi-byte character intact when it straddles a chunk boundary', async () => {
    // Decoding each chunk separately would turn this into replacement
    // characters. Merging first and decoding once is what avoids it.
    const encoded = new TextEncoder().encode('{"note":"🔥"}');
    const stream = streamOf([encoded.slice(0, 11), encoded.slice(11)]);

    await expect(readJsonBody(streamRequest(stream))).resolves.toEqual({ note: '🔥' });
  });

  it('still returns 413 when cancelling the dead stream throws', async () => {
    // This is the path that runs while someone is attacking, which is the worst
    // possible moment for the status code to be wrong.
    const chunk = new TextEncoder().encode('x'.repeat(8 * 1024));
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
      cancel() {
        throw new Error('socket already destroyed');
      },
    });

    expect(await statusOf(streamRequest(stream))).toBe(413);
  });

  it('reports a client that hangs up mid-upload as a 400, not a server error', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('aborted by peer'));
      },
    });

    expect(await statusOf(streamRequest(stream))).toBe(400);
  });

  it('stops reading rather than buffering the whole oversized body', async () => {
    // The limit has to hold without a content-length header, or chunked
    // encoding walks straight past it.
    let bytesProduced = 0;
    const chunk = new TextEncoder().encode('x'.repeat(8 * 1024));
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        bytesProduced += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });

    const request = streamRequest(stream);

    expect(await statusOf(request)).toBe(413);
    expect(request.headers.get('content-length')).toBeNull();
    // A megabyte would mean it read everything before checking.
    expect(bytesProduced).toBeLessThan(64 * 1024);
  });
});
