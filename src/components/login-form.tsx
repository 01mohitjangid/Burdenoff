'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fieldsFor, messageFor } from '@/client/api-client';
import { login } from '@/client/auth.api';
import type { FieldErrors } from '@/lib/api-contract';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusyButton } from './busy-button';
import { ErrorBanner } from './error-banner';
import { FieldError } from './field-error';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    setFields({});

    try {
      await login({ email, password });
      router.push('/dashboard');
      router.refresh();
    } catch (thrown) {
      setError(messageFor(thrown));
      setFields(fieldsFor(thrown));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          aria-invalid={Boolean(fields.email?.length)}
          aria-describedby="email-error"
        />
        <FieldError fields={fields} name="email" id="email-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          aria-invalid={Boolean(fields.password?.length)}
          aria-describedby="password-error"
        />
        <FieldError fields={fields} name="password" id="password-error" />
      </div>

      <ErrorBanner message={error} />

      <BusyButton busy={pending} busyLabel="Logging in…" className="w-full">
        Log in
      </BusyButton>
    </form>
  );
}
