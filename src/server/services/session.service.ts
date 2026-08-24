import 'server-only';
import type { PublicUser } from '@/lib/api-contract';
import { SESSION_DURATION_SECONDS } from '@/lib/session-token';
import { prisma } from '../db';
import { PUBLIC_USER_SELECT } from './user.service';

/**
 * Sessions as rows, so that logging out is something the server can actually do.
 *
 * The cookie holds a signed token naming one of these rows. Verifying the
 * signature proves the cookie was not forged; finding the row proves the session
 * is still meant to be alive. Both are required, and only the second can be
 * revoked — which is the whole reason the table exists.
 */

/** Opens a session and returns its id, which is what the token will name. */
export async function createSession(
  userId: string,
  now: Date = new Date()
): Promise<string> {
  const { id } = await prisma.session.create({
    data: {
      userId,
      // Kept in step with the token's own expiry on purpose. Two clocks that
      // disagree would mean a session that is live by one and dead by the other.
      expiresAt: new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000),
    },
    select: { id: true },
  });
  return id;
}

/**
 * The user behind a live session, or `null`.
 *
 * One query does both jobs: it resolves the user and confirms the session still
 * exists and has not expired. Reading the user separately would cost a second
 * round trip for an answer this row already contains.
 *
 * `expiresAt` is re-checked here even though the token carries the same expiry.
 * The token is only as trustworthy as its clock; the row is the record.
 */
export async function findSessionUser(
  sessionId: string,
  now: Date = new Date()
): Promise<PublicUser | null> {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, expiresAt: { gt: now } },
    select: { user: { select: PUBLIC_USER_SELECT } },
  });
  return session?.user ?? null;
}

/**
 * Ends one session. Silent when the row is already gone.
 *
 * `deleteMany` rather than `delete`: deleting a missing row throws, and a second
 * logout — a double-clicked button, a retried request — is not an error.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

/** Ends every session for a user, e.g. after a password change. */
export async function deleteUserSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

/**
 * Sweeps rows whose tokens can no longer be presented anyway.
 *
 * Nothing depends on this running: `findSessionUser` already refuses an expired
 * row. It only keeps the table from growing forever, so a cron or a deploy hook
 * is the right caller, not a request.
 */
export async function deleteExpiredSessions(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  return count;
}
