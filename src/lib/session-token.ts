import { SignJWT, jwtVerify } from 'jose';

/** How long a session lasts before the user has to log in again. */
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

const ALGORITHM = 'HS256';

interface TokenOptions {
  /** Injectable clock, so expiry can be tested without waiting a week. */
  now?: Date;
}

interface CreateTokenOptions extends TokenOptions {
  expiresInSeconds?: number;
}

/**
 * Marks what this token is for. If a later feature signs a password-reset token
 * with the same secret, this claim is what stops one being used as the other.
 */
const AUDIENCE = 'habit-tracker/session';

function keyFrom(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Signs a session token.
 *
 * The token carries a session id and nothing else — not the user id, and in
 * particular not the user's time zone. Freezing a copy of the zone in here
 * would keep serving the old one until the token expired.
 *
 * Naming the session rather than the user is what makes logout real. The
 * signature cannot be withdrawn once issued, so a token that named the user
 * directly would keep working for its full lifetime no matter what the server
 * did. Naming a row instead means deleting that row ends the session at once.
 */
export async function createSessionToken(
  sessionId: string,
  secret: string,
  options: CreateTokenOptions = {}
): Promise<string> {
  const now = options.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1000);
  const lifetime = options.expiresInSeconds ?? SESSION_DURATION_SECONDS;

  return new SignJWT()
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(sessionId)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + lifetime)
    .sign(keyFrom(secret));
}

/**
 * Returns the session id inside a valid token, or `null`.
 *
 * Every failure — wrong signature, expired, tampered, malformed — collapses to
 * `null`. A caller cannot accidentally treat "this token is broken" as "this
 * token is fine", and nothing about why it failed leaks back to the client.
 */
export async function readSessionToken(
  token: string,
  secret: string,
  options: TokenOptions = {}
): Promise<string | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, keyFrom(secret), {
      algorithms: [ALGORITHM],
      audience: AUDIENCE,
      currentDate: options.now,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
