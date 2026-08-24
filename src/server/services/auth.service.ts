import 'server-only';
import { Prisma } from '@prisma/client';
import type { PublicUser } from '@/lib/api-contract';
import type { LoginInput, SignupInput } from '@/lib/validation/auth';
import { ApiError } from '../api-error';
import { prisma } from '../db';
import { hashPassword, verifyAgainstDecoy, verifyPassword } from '../password';
import { PUBLIC_USER_SELECT } from './user.service';

/** Postgres unique-constraint violation, as Prisma reports it. */
const UNIQUE_VIOLATION = 'P2002';

export async function registerUser(input: SignupInput): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        timeZone: input.timeZone,
      },
      select: PUBLIC_USER_SELECT,
    });
  } catch (error) {
    // Checking for an existing row first would still lose the race between the
    // check and the insert. The unique index is the real guard; this turns its
    // error into a readable one.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    ) {
      throw ApiError.emailTaken();
    }
    throw error;
  }
}

export async function authenticateUser(input: LoginInput): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...PUBLIC_USER_SELECT, passwordHash: true },
  });

  // No account: still spend the time a real check would, so response timing
  // does not reveal which emails are registered.
  if (!user) {
    await verifyAgainstDecoy(input.password);
    throw ApiError.invalidCredentials();
  }

  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) throw ApiError.invalidCredentials();

  return { id: user.id, email: user.email, timeZone: user.timeZone };
}
