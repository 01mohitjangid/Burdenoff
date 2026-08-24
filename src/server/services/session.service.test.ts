import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

// Stubbed client, like the other service tests: what matters here is which
// query is issued and how its answer is read, not that Postgres runs it.
vi.mock('../db', () => ({
  prisma: {
    session: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { SESSION_DURATION_SECONDS } from '@/lib/session-token';
import { prisma } from '../db';
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  deleteUserSessions,
  findSessionUser,
} from './session.service';

const create = prisma.session.create as unknown as Mock;
const findFirst = prisma.session.findFirst as unknown as Mock;
const deleteMany = prisma.session.deleteMany as unknown as Mock;

const user = {
  id: 'user_1',
  email: 'mohit@example.com',
  timeZone: 'Asia/Kolkata',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSession', () => {
  it('returns the row id, which is what the cookie will name', async () => {
    create.mockResolvedValue({ id: 'sess_1' });
    expect(await createSession('user_1')).toBe('sess_1');
  });

  it('expires the row exactly when the token does', async () => {
    create.mockResolvedValue({ id: 'sess_1' });
    const now = new Date('2026-03-12T00:00:00Z');

    await createSession('user_1', now);

    const { data } = create.mock.calls[0][0];
    expect(data.userId).toBe('user_1');
    expect(data.expiresAt.getTime()).toBe(
      now.getTime() + SESSION_DURATION_SECONDS * 1000
    );
  });

  it('never selects anything but the id', async () => {
    create.mockResolvedValue({ id: 'sess_1' });
    await createSession('user_1');
    expect(create.mock.calls[0][0].select).toEqual({ id: true });
  });
});

describe('findSessionUser', () => {
  it('returns the user behind a live session', async () => {
    findFirst.mockResolvedValue({ user });
    expect(await findSessionUser('sess_1')).toEqual(user);
  });

  it('refuses a session id that no longer has a row', async () => {
    // This is the deleted-on-logout case: the token still verifies, and the
    // answer is still null.
    findFirst.mockResolvedValue(null);
    expect(await findSessionUser('sess_gone')).toBeNull();
  });

  it('asks the database for an unexpired row, rather than filtering after', async () => {
    findFirst.mockResolvedValue({ user });
    const now = new Date('2026-03-12T00:00:00Z');

    await findSessionUser('sess_1', now);

    expect(findFirst.mock.calls[0][0].where).toEqual({
      id: 'sess_1',
      expiresAt: { gt: now },
    });
  });

  it('never selects a password hash, even through the relation', async () => {
    findFirst.mockResolvedValue({ user });
    await findSessionUser('sess_1');

    const select = findFirst.mock.calls[0][0].select.user.select;
    expect(select).not.toHaveProperty('passwordHash');
    expect(Object.keys(select).sort()).toEqual(['email', 'id', 'timeZone']);
  });
});

describe('deleteSession', () => {
  it('deletes the named row', async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    await deleteSession('sess_1');
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'sess_1' } });
  });

  it('does not throw when the row is already gone', async () => {
    // A double-clicked logout button must not surface as a 500.
    deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteSession('sess_gone')).resolves.toBeUndefined();
  });
});

describe('deleteUserSessions', () => {
  it('reports how many sessions it ended', async () => {
    deleteMany.mockResolvedValue({ count: 3 });
    expect(await deleteUserSessions('user_1')).toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
  });
});

describe('deleteExpiredSessions', () => {
  it('sweeps only rows that are already past their expiry', async () => {
    deleteMany.mockResolvedValue({ count: 2 });
    const now = new Date('2026-03-12T00:00:00Z');

    expect(await deleteExpiredSessions(now)).toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } });
  });
});
