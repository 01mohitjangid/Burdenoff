import { NextResponse } from 'next/server';
import type { HabitDetailResponse, HabitResponse } from '@/lib/api-contract';
import { updateHabitSchema } from '@/lib/validation/habit';
import { type RouteContext, readJsonBody, route } from '@/server/handler';
import {
  deleteHabit,
  getHabitDetail,
  updateHabit,
} from '@/server/services/habit.service';
import { requireUser } from '@/server/session';

export const GET = route(
  async (_request: Request, { params }: RouteContext<{ id: string }>) => {
    const user = await requireUser();
    const { id } = await params;
    const { habit, checkIns, today } = await getHabitDetail(user, id);

    const body: HabitDetailResponse = { habit, checkIns, today };
    return NextResponse.json(body);
  }
);

export const PATCH = route(
  async (request: Request, { params }: RouteContext<{ id: string }>) => {
    const user = await requireUser();
    const { id } = await params;
    const input = updateHabitSchema.parse(await readJsonBody(request));
    const { habit, today } = await updateHabit(user, id, input);

    const body: HabitResponse = { habit, today };
    return NextResponse.json(body);
  }
);

export const DELETE = route(
  async (_request: Request, { params }: RouteContext<{ id: string }>) => {
    const user = await requireUser();
    const { id } = await params;
    await deleteHabit(user, id);

    return new NextResponse(null, { status: 204 });
  }
);
