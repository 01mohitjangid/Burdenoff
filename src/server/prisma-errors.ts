import 'server-only';
import { Prisma } from '@prisma/client';

/** Postgres unique-constraint violation, as Prisma reports it. */
const UNIQUE_VIOLATION = 'P2002';

/**
 * True when a write lost a race against a unique index.
 *
 * Services insert and catch this rather than reading first: a read followed by
 * an insert still leaves a window between the two, and a double-tapped button
 * is exactly that window.
 *
 * It lives apart from `db.ts` on purpose. A test that stubs the Prisma client
 * should not have to re-implement this predicate to keep working.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  );
}
