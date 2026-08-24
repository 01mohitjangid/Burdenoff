import 'server-only';
import bcrypt from 'bcryptjs';

/**
 * OWASP's current floor for bcrypt. Measured at roughly 220ms per hash here,
 * which is slow enough to matter to someone guessing and fast enough not to
 * matter to someone logging in.
 */
const COST_FACTOR = 12;

/**
 * A real bcrypt hash of a string nobody uses as a password.
 *
 * When an unknown email tries to log in there is no hash to check, so the
 * request would return noticeably faster than one for a real account — which is
 * enough to enumerate who has an account. Verifying against this decoy makes
 * both paths cost the same.
 */
export const DECOY_HASH = '$2b$12$6yS9GHTC8D.anEw5DbTa7e0A9/988mW2R5COB7WL9ybMpqCohOqxa';

export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, COST_FACTOR);
}

export function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/** Burns the same time a real password check would, and always fails. */
export async function verifyAgainstDecoy(plainText: string): Promise<false> {
  await bcrypt.compare(plainText, DECOY_HASH);
  return false;
}
