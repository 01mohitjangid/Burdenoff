import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

// The service is tested against a stubbed client rather than a live database:
// the branches that matter here are error mapping and the unknown-email path,
// and neither needs Postgres to be running.
vi.mock('../db', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { Prisma } from '@prisma/client';
import { ApiError } from '../api-error';
import { prisma } from '../db';
import { hashPassword } from '../password';
import { authenticateUser, registerUser } from './auth.service';

// Prisma types these methods by their unselected return shape, so a `select`ed
// fixture will not satisfy them. The mocks are cast rather than padded with
// columns the service never asks for.
const create = prisma.user.create as unknown as Mock;
const findUnique = prisma.user.findUnique as unknown as Mock;

const storedUser = {
  id: 'user_1',
  email: 'mohit@example.com',
  timeZone: 'Asia/Kolkata',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerUser', () => {
  it('stores a hash, never the password itself', async () => {
    create.mockResolvedValue(storedUser);

    await registerUser({
      email: storedUser.email,
      password: 'correct-horse-battery',
      timeZone: storedUser.timeZone,
    });

    const written = create.mock.calls[0][0].data as { passwordHash: string };
    expect(written.passwordHash).not.toBe('correct-horse-battery');
    expect(written.passwordHash.startsWith('$2')).toBe(true);
  });

  it('turns the unique-index violation into a readable 409', async () => {
    // Checking for the row first would still lose the race, so the constraint
    // is the guard and this mapping is how the user hears about it.
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    await expect(
      registerUser({ email: storedUser.email, password: 'x'.repeat(12), timeZone: 'UTC' })
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });

  it('does not disguise an unrelated database failure as a duplicate email', async () => {
    create.mockRejectedValue(new Error('connection reset'));

    await expect(
      registerUser({ email: storedUser.email, password: 'x'.repeat(12), timeZone: 'UTC' })
    ).rejects.not.toBeInstanceOf(ApiError);
  });
});

describe('authenticateUser', () => {
  it('returns the user when the password matches', async () => {
    findUnique.mockResolvedValue({
      ...storedUser,
      passwordHash: await hashPassword('correct-horse-battery'),
    });

    await expect(
      authenticateUser({ email: storedUser.email, password: 'correct-horse-battery' })
    ).resolves.toEqual(storedUser);
  });

  it('never returns the password hash to the caller', async () => {
    findUnique.mockResolvedValue({
      ...storedUser,
      passwordHash: await hashPassword('correct-horse-battery'),
    });

    const user = await authenticateUser({
      email: storedUser.email,
      password: 'correct-horse-battery',
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('gives the same error for an unknown email and a wrong password', async () => {
    findUnique.mockResolvedValueOnce(null);
    const unknownEmail = await authenticateUser({
      email: 'nobody@example.com',
      password: 'whatever-it-is',
    }).catch((error: ApiError) => error);

    findUnique.mockResolvedValueOnce({
      ...storedUser,
      passwordHash: await hashPassword('correct-horse-battery'),
    });
    const wrongPassword = await authenticateUser({
      email: storedUser.email,
      password: 'not-the-password',
    }).catch((error: ApiError) => error);

    // Two different messages here would tell an attacker which emails exist.
    expect(unknownEmail).toBeInstanceOf(ApiError);
    expect(wrongPassword).toBeInstanceOf(ApiError);
    expect((unknownEmail as ApiError).status).toBe((wrongPassword as ApiError).status);
    expect((unknownEmail as ApiError).code).toBe((wrongPassword as ApiError).code);
    expect((unknownEmail as ApiError).message).toBe((wrongPassword as ApiError).message);
  });
});
