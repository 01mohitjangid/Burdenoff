import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, fieldsFor, messageFor, request } from './api-client';

function respondWith(body: unknown, init: ResponseInit = {}): void {
  const response =
    init.status === 204
      ? new Response(null, init)
      : new Response(JSON.stringify(body), {
          ...init,
          headers: { 'content-type': 'application/json' },
        });

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('always declares JSON, even with no body', async () => {
    // The API rejects anything else, and fetch stamps text/plain on a string
    // body left to itself. This is the easiest thing to forget at a call site.
    respondWith({ ok: true });

    await request('/api/thing', { method: 'POST' });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    );
    expect(init?.body).toBeUndefined();
  });

  it('serialises the body as JSON', async () => {
    // Without this the browser sends "[object Object]" and every write in the
    // app 400s, while a test that only checks the header stays green.
    respondWith({ ok: true });

    await request('/api/habits', {
      method: 'POST',
      body: { name: 'Read', description: null },
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe('{"name":"Read","description":null}');
  });

  it('does not try to read a 204', async () => {
    // DELETE returns no body at all, so parsing it would throw.
    respondWith(null, { status: 204 });

    await expect(request('/api/thing', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('returns the parsed body on success', async () => {
    respondWith({ habits: [], today: '2026-03-12' });

    await expect(request('/api/habits')).resolves.toEqual({
      habits: [],
      today: '2026-03-12',
    });
  });

  it('turns an API error into a typed error, fields included', async () => {
    respondWith(
      {
        error: {
          code: 'DUPLICATE_CHECK_IN',
          message: 'This habit is already checked in for that day.',
          fields: { localDay: ['2026-03-12 is already done.'] },
        },
      },
      { status: 409 }
    );

    const error = await request('/api/habits/h1/check-ins', { method: 'POST' }).catch(
      (thrown: unknown) => thrown
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 409,
      code: 'DUPLICATE_CHECK_IN',
      // Asserted, not merely supplied: the whole point of the typed error is
      // that the server's wording reaches the user unchanged.
      message: 'This habit is already checked in for that day.',
    });
    expect(messageFor(error)).toBe('This habit is already checked in for that day.');
    expect(fieldsFor(error)).toEqual({ localDay: ['2026-03-12 is already done.'] });
  });

  it('survives a failure that is not our error shape', async () => {
    // A crashed gateway returns HTML. Parsing it must not replace the real
    // problem with a JSON syntax error.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 }))
    );

    const error = await request('/api/habits').catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
    expect(messageFor(error)).toBe('Something went wrong. Please try again.');
  });
});

describe('messageFor', () => {
  it('shows the API message when there is one', () => {
    const error = new ApiClientError(409, 'EMAIL_TAKEN', 'That email is taken.');
    expect(messageFor(error)).toBe('That email is taken.');
  });

  it('never leaks an unexpected error’s text to the user', () => {
    expect(messageFor(new TypeError('fetch failed: ECONNREFUSED 127.0.0.1:5432'))).toBe(
      'Something went wrong. Please try again.'
    );
  });
});
