import { describe, expect, it } from 'vitest';
import { DECOY_HASH, hashPassword, verifyAgainstDecoy, verifyPassword } from './password';

const password = 'correct-horse-battery';

describe('password hashing', () => {
  it('never stores the password itself', async () => {
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('produces a different hash every time, so equal passwords are not equal rows', async () => {
    const [first, second] = await Promise.all([
      hashPassword(password),
      hashPassword(password),
    ]);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password, second)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword(password);
    expect(await verifyPassword('correct-horse-batteru', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });
});

describe('the login timing decoy', () => {
  it('is a real bcrypt hash at the same cost as a stored password', () => {
    // Asserting only that the decoy check returns false would pass even if the
    // decoy were the string "nonsense": bcrypt returns false for a malformed
    // hash immediately, which is exactly the timing leak this defends against.
    expect(DECOY_HASH).toMatch(/^\$2[aby]\$12\$/);
  });

  it('actually spends time, so an unknown email costs what a real one costs', async () => {
    const startedAt = performance.now();
    const result = await verifyAgainstDecoy(password);
    const elapsed = performance.now() - startedAt;

    expect(result).toBe(false);
    // A cost-12 hash measures about 220ms here. A malformed decoy returns in
    // well under a millisecond, so this bound separates the two cleanly.
    expect(elapsed).toBeGreaterThan(50);
  });
});
