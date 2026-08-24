import 'server-only';
import { cookies } from 'next/headers';
import type { PublicUser } from '@/lib/api-contract';
import {
  SESSION_DURATION_SECONDS,
  createSessionToken,
  readSessionToken,
} from '@/lib/session-token';
import { ApiError } from './api-error';
import { env } from './env';
import {
  createSession,
  deleteSession,
  findSessionUser,
} from './services/session.service';

export const SESSION_COOKIE_NAME = 'habit_session';

/**
 * Opens a session for this user and writes the cookie.
 *
 * Two things are created, not one: a row that can be deleted, and a signed
 * token that names it. The signature stops the cookie being forged; the row is
 * what logout removes.
 */
export async function startSession(userId: string): Promise<void> {
  const sessionId = await createSession(userId);
  const token = await createSessionToken(sessionId, env.SESSION_SECRET);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    // Not readable from JavaScript, so a script injection cannot steal it.
    httpOnly: true,
    // Fails closed: only an explicit development environment gets a cookie that
    // may travel over plain HTTP. An unset NODE_ENV stays secure.
    secure: env.NODE_ENV !== 'development',
    // Blocks the cookie on cross-site POSTs, which is the CSRF case that matters.
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/**
 * Ends the current session everywhere, not just in this browser.
 *
 * Clearing the cookie alone would only tidy up the one client that asked. The
 * row is deleted first, so a copy of the same cookie taken earlier stops working
 * on its very next request instead of lasting until the token expires.
 *
 * The row is deleted before the cookie is cleared. If the delete fails the
 * request errors and the cookie survives, which leaves the caller logged in and
 * able to try again — the honest outcome. Clearing first could report success
 * while the session was still live on the server.
 */
export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const sessionId = await readSessionToken(token, env.SESSION_SECRET);
    if (sessionId) await deleteSession(sessionId);
  }

  // Cleared even when the token was junk or already expired, so a stale cookie
  // never lingers in the browser.
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * The logged-in user, or `null`.
 *
 * A valid signature is necessary but not sufficient: the named session must
 * still exist. That second check is what makes logout, and a deleted account,
 * take effect on the very next request rather than whenever the token expires.
 *
 * The user is read through the session row rather than copied into the token,
 * so a changed time zone is picked up immediately too.
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const sessionId = await readSessionToken(token, env.SESSION_SECRET);
  if (!sessionId) return null;

  return findSessionUser(sessionId);
}

/** Same as `getCurrentUser`, but throws a 401 instead of returning `null`. */
export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw ApiError.unauthenticated();
  return user;
}
