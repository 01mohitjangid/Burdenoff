import { NextResponse } from 'next/server';
import { route } from '@/server/handler';
import { endSession } from '@/server/session';

export const POST = route(async () => {
  await endSession();
  return new NextResponse(null, { status: 204 });
});
