import { describe, expect, it } from 'vitest';
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  loginSchema,
  signupSchema,
} from './auth';

const validSignup = {
  email: 'mohit@example.com',
  password: 'correct-horse-battery',
  timeZone: 'Asia/Kolkata',
};

describe('signupSchema', () => {
  it('accepts a well-formed signup', () => {
    const result = signupSchema.safeParse(validSignup);
    expect(result.success).toBe(true);
  });

  it('normalises the email so one address cannot register twice', () => {
    const result = signupSchema.parse({ ...validSignup, email: '  Mohit@Example.COM ' });
    expect(result.email).toBe('mohit@example.com');
  });

  it('rejects a malformed email', () => {
    expect(
      signupSchema.safeParse({ ...validSignup, email: 'not-an-email' }).success
    ).toBe(false);
  });

  it('rejects a password below the minimum length', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(signupSchema.safeParse({ ...validSignup, password: short }).success).toBe(
      false
    );
  });

  it('rejects a password longer than bcrypt can actually read', () => {
    // bcrypt silently ignores everything past 72 bytes, so two different long
    // passwords sharing a prefix would both unlock the account.
    const tooLong = 'a'.repeat(MAX_PASSWORD_BYTES + 1);
    expect(signupSchema.safeParse({ ...validSignup, password: tooLong }).success).toBe(
      false
    );
  });

  it('counts the password limit in bytes, not characters', () => {
    // An emoji is four bytes, so 20 of them exceed 72 bytes at 20 characters.
    const emoji = '🔥'.repeat(20);
    expect(new TextEncoder().encode(emoji).length).toBeGreaterThan(MAX_PASSWORD_BYTES);
    expect(signupSchema.safeParse({ ...validSignup, password: emoji }).success).toBe(
      false
    );
  });

  it('accepts real IANA time zones', () => {
    for (const timeZone of ['Asia/Kolkata', 'America/New_York', 'UTC']) {
      expect(signupSchema.safeParse({ ...validSignup, timeZone }).success).toBe(true);
    }
  });

  it('rejects an ambiguous or unknown time zone', () => {
    for (const timeZone of ['IST', 'EST', 'Asia/Nowhere', '']) {
      expect(signupSchema.safeParse({ ...validSignup, timeZone }).success).toBe(false);
    }
  });

  it('rejects unknown fields instead of silently dropping them', () => {
    const result = signupSchema.safeParse({ ...validSignup, isAdmin: true });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password', () => {
    // Applying the signup strength rules here would lock out anyone whose
    // password predates the rule, and it advertises the policy to attackers.
    const result = loginSchema.safeParse({ email: 'mohit@example.com', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(
      loginSchema.safeParse({ email: 'mohit@example.com', password: '' }).success
    ).toBe(false);
  });

  it('normalises the email the same way signup does', () => {
    const result = loginSchema.parse({
      email: ' MOHIT@example.com ',
      password: 'secret',
    });
    expect(result.email).toBe('mohit@example.com');
  });
});
