import 'server-only';
import type { PublicUser } from '@/lib/api-contract';
import { prisma } from '../db';

/**
 * The one definition of which user columns may leave the server.
 *
 * Written once on purpose: the day someone adds a third `select` by hand is the
 * day `passwordHash` ships to a browser.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  timeZone: true,
  // `satisfies` is what makes the comment above true. A return type alone does
  // not catch an over-selected column, because excess-property checking applies
  // only to fresh object literals and a Prisma result is not one. Adding
  // `passwordHash: true` here is a compile error.
} as const satisfies Record<keyof PublicUser, true>;

export function findUserById(id: string): Promise<PublicUser | null> {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
}
