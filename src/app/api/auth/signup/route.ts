import { NextResponse } from 'next/server';
import type { AuthResponse } from '@/lib/api-contract';
import { signupSchema } from '@/lib/validation/auth';
import { readJsonBody, route } from '@/server/handler';
import { registerUser } from '@/server/services/auth.service';
import { startSession } from '@/server/session';

export const POST = route(async (request: Request) => {
  const input = signupSchema.parse(await readJsonBody(request));
  const user = await registerUser(input);
  await startSession(user.id);

  const body: AuthResponse = { user };
  return NextResponse.json(body, { status: 201 });
});
