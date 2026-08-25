import { NextResponse } from 'next/server';
import type { HabitResponse, HabitsResponse } from '@/lib/api-contract';
import { createHabitSchema } from '@/lib/validation/habit';
import { readJsonBody, route } from '@/server/handler';
import { createHabit, listHabits } from '@/server/services/habit.service';
import { requireUser } from '@/server/session';

export const GET = route(async () => {
  const user = await requireUser();
  const { habits, today } = await listHabits(user);

  const body: HabitsResponse = { habits, today };
  return NextResponse.json(body);
});

export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const input = createHabitSchema.parse(await readJsonBody(request));
  const { habit, today } = await createHabit(user, input);

  const body: HabitResponse = { habit, today };
  return NextResponse.json(body, { status: 201 });
});
