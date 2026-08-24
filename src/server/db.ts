import 'server-only';

import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * A single Prisma client per process. Next.js reloads modules in development,
 * and a fresh client per reload exhausts the database connection pool, so the
 * instance is parked on `globalThis` outside production.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
