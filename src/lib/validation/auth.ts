import { z } from 'zod';
import { isValidTimeZone } from '../local-day';

export const MIN_PASSWORD_LENGTH = 8;

/**
 * bcrypt reads at most 72 bytes and silently ignores the rest, so two different
 * long passwords that share a 72-byte prefix would both unlock the account.
 * Rejecting is honest; truncating is a hidden security hole.
 */
export const MAX_PASSWORD_BYTES = 72;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z.email('Enter a valid email address').max(254, 'That email address is too long')
  );

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .refine(
    (value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES,
    `Password must be at most ${MAX_PASSWORD_BYTES} bytes long`
  );

const timeZoneSchema = z
  .string()
  .refine(isValidTimeZone, 'Choose a valid IANA time zone, for example Asia/Kolkata');

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    timeZone: timeZoneSchema,
  })
  .strict();

/**
 * Login deliberately does not apply the signup strength rules. Enforcing them
 * here would lock out anyone whose password predates a rule change, and the
 * error messages would advertise the policy to whoever is guessing.
 */
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Enter your password'),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
