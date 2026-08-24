import 'server-only';

import { z } from 'zod';

/**
 * The one place in the app allowed to read `process.env`.
 *
 * Everything else imports the typed values from here, so a missing variable
 * fails loudly at startup instead of surfacing as `undefined` in production.
 */
const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required. Copy .env.example to .env and fill it in.'),
  SESSION_SECRET: z
    .string()
    .min(
      32,
      'SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32'
    ),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsed.data;
