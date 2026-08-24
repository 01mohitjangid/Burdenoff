import { NextResponse } from 'next/server';
import type { MeResponse } from '@/lib/api-contract';
import { todayIn } from '@/lib/local-day';
import { route } from '@/server/handler';
import { requireUser } from '@/server/session';

export const GET = route(async () => {
  const user = await requireUser();

  // The server owns "today". The browser's clock and time zone are never
  // consulted, so a user cannot check in for tomorrow by changing their laptop.
  const body: MeResponse = { user, today: todayIn(user.timeZone) };
  return NextResponse.json(body);
});
