import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These tests exist for one claim: after logout, a cookie that still verifies
 * must stop working. That is the whole difference between a session row and a
 * bare signed token, so it is worth pinning down rather than assuming.
 */

// A cookie jar small enough to reason about, standing in for `next/headers`.
const jar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

// The session table, as a Map. `findFirst` is deliberately written to honour
// `expiresAt` the same way Postgres would, so an expired row fails here too.
interface Row {
  id: string;
  userId: string;
  expiresAt: Date;
}
const rows = new Map<string, Row>();
let nextId = 0;

const user = { id: 'user_1', email: 'mohit@example.com', timeZone: 'Asia/Kolkata' };

vi.mock('./db', () => ({
  prisma: {
    session: {
      create: async ({ data }: { data: { userId: string; expiresAt: Date } }) => {
        const id = `sess_${++nextId}`;
        rows.set(id, { id, ...data });
        return { id };
      },
      findFirst: async ({
        where,
      }: {
        where: { id: string; expiresAt: { gt: Date } };
      }) => {
        const row = rows.get(where.id);
        if (!row || row.expiresAt <= where.expiresAt.gt) return null;
        return { user };
      },
      deleteMany: async ({ where }: { where: { id?: string; userId?: string } }) => {
        if (where.id) return { count: rows.delete(where.id) ? 1 : 0 };
        let count = 0;
        for (const [id, row] of rows) {
          if (row.userId === where.userId) {
            rows.delete(id);
            count++;
          }
        }
        return { count };
      },
    },
  },
}));

import { ApiError } from './api-error';
import { SESSION_COOKIE_NAME, endSession, getCurrentUser, requireUser } from './session';

beforeEach(() => {
  jar.clear();
  rows.clear();
  nextId = 0;
});

describe('session lifecycle', () => {
  it('recognises the user after the session starts', async () => {
    const { startSession } = await import('./session');
    await startSession('user_1');

    expect(jar.has(SESSION_COOKIE_NAME)).toBe(true);
    expect(await getCurrentUser()).toEqual(user);
  });

  it('has nobody logged in when there is no cookie', async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it('refuses a cookie that is not a real token', async () => {
    jar.set(SESSION_COOKIE_NAME, 'not.a.token');
    expect(await getCurrentUser()).toBeNull();
  });

  it('throws a 401 from requireUser rather than returning null', async () => {
    await expect(requireUser()).rejects.toBeInstanceOf(ApiError);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});

describe('logout', () => {
  it('deletes the session row, not just the cookie', async () => {
    const { startSession } = await import('./session');
    await startSession('user_1');
    expect(rows.size).toBe(1);

    await endSession();

    expect(rows.size).toBe(0);
    expect(jar.has(SESSION_COOKIE_NAME)).toBe(false);
  });

  it('kills a cookie that was copied before logout', async () => {
    // The point of the whole change. The stolen cookie still carries a valid
    // signature after logout; it must still be refused.
    const { startSession } = await import('./session');
    await startSession('user_1');
    const stolen = jar.get(SESSION_COOKIE_NAME)!;

    await endSession();

    jar.set(SESSION_COOKIE_NAME, stolen);
    expect(await getCurrentUser()).toBeNull();
  });

  it('clears a junk cookie without needing a matching row', async () => {
    jar.set(SESSION_COOKIE_NAME, 'not.a.token');
    await endSession();
    expect(jar.has(SESSION_COOKIE_NAME)).toBe(false);
  });

  it('is safe to call twice', async () => {
    const { startSession } = await import('./session');
    await startSession('user_1');

    await endSession();
    await expect(endSession()).resolves.toBeUndefined();
  });
});

describe('expiry', () => {
  it('refuses a session whose row has passed its expiry', async () => {
    const { startSession } = await import('./session');
    await startSession('user_1');

    // The token is still inside its own week-long window; the row is not.
    for (const row of rows.values()) row.expiresAt = new Date(Date.now() - 1000);

    expect(await getCurrentUser()).toBeNull();
  });
});
