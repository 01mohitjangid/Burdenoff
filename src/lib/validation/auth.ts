import { z } from 'zod';
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '../limits';
import { isValidTimeZone } from '../local-day';

export { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '../limits';

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
