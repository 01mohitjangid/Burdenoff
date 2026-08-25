import { NextResponse } from 'next/server';
import type { CheckInResponse } from '@/lib/api-contract';
import { createCheckInSchema } from '@/lib/validation/habit';
import { type RouteContext, readJsonBody, route } from '@/server/handler';
import { createCheckIn } from '@/server/services/check-in.service';
import { requireUser } from '@/server/session';

export const POST = route(
  async (request: Request, { params }: RouteContext<{ id: string }>) => {
    const user = await requireUser();
    const { id } = await params;
    const input = createCheckInSchema.parse(await readJsonBody(request));

    // No localDay means today, which is what the one-click button sends. The
    // server decides what today is; the browser's clock is never consulted.
    const { checkIn, habit, today } = await createCheckIn({
      user,
      habitId: id,
      localDay: input.localDay,
    });

    const body: CheckInResponse = { checkIn, habit, today };
    return NextResponse.json(body, { status: 201 });
  }
);
