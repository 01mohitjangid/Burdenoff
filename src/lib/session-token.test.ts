import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  SESSION_DURATION_SECONDS,
  createSessionToken,
  readSessionToken,
} from './session-token';

const secret = 'a-test-secret-long-enough-for-hs256-signing';
const sessionId = 'sess_123';

describe('session tokens', () => {
  it('round-trips a session id', async () => {
    const token = await createSessionToken(sessionId, secret);
    expect(await readSessionToken(token, secret)).toBe(sessionId);
  });

  it('refuses a token signed with a different secret', async () => {
    const token = await createSessionToken(sessionId, secret);
    expect(
      await readSessionToken(token, 'a-completely-different-secret-value')
    ).toBeNull();
  });

  it('refuses a tampered token', async () => {
    const token = await createSessionToken(sessionId, secret);
    const tampered = `${token.slice(0, -2)}xy`;
    expect(await readSessionToken(tampered, secret)).toBeNull();
  });

  it('refuses a token that has expired', async () => {
    const issuedAt = new Date('2026-03-12T00:00:00Z');
    const token = await createSessionToken(sessionId, secret, { now: issuedAt });

    const justInside = new Date(
      issuedAt.getTime() + (SESSION_DURATION_SECONDS - 60) * 1000
    );
    const justOutside = new Date(
      issuedAt.getTime() + (SESSION_DURATION_SECONDS + 60) * 1000
    );

    expect(await readSessionToken(token, secret, { now: justInside })).toBe(sessionId);
    expect(await readSessionToken(token, secret, { now: justOutside })).toBeNull();
  });

  it('refuses a token minted for a different purpose', async () => {
    // If a later feature signs password-reset tokens with the same secret, this
    // is what stops one being presented as the other.
    const otherPurpose = await new SignJWT()
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sessionId)
      .setAudience('habit-tracker/password-reset')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    expect(await readSessionToken(otherPurpose, secret)).toBeNull();
  });

  it('refuses obvious rubbish without throwing', async () => {
    for (const rubbish of ['', 'not.a.token', 'a.b.c']) {
      expect(await readSessionToken(rubbish, secret)).toBeNull();
    }
  });
});
