import 'client-only';
import type { AuthResponse } from '@/lib/api-contract';
import type { LoginInput, SignupInput } from '@/lib/validation/auth';
import { request } from './api-client';

export function signup(input: SignupInput): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/signup', { method: 'POST', body: input });
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', { method: 'POST', body: input });
}

export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' });
}
