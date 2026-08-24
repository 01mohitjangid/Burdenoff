import { NextResponse } from 'next/server';
import type { AuthResponse } from '@/lib/api-contract';
import { loginSchema } from '@/lib/validation/auth';
import { readJsonBody, route } from '@/server/handler';
import { authenticateUser } from '@/server/services/auth.service';
import { startSession } from '@/server/session';

export const POST = route(async (request: Request) => {
  const input = loginSchema.parse(await readJsonBody(request));
  const user = await authenticateUser(input);
  await startSession(user.id);

  const body: AuthResponse = { user };
  return NextResponse.json(body);
});
