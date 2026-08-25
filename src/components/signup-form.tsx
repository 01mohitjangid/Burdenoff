'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fieldsFor, messageFor } from '@/client/api-client';
import { signup } from '@/client/auth.api';
import type { FieldErrors } from '@/lib/api-contract';
import { useDetectedTimeZone } from '@/hooks/use-detected-time-zone';
import { MIN_PASSWORD_LENGTH } from '@/lib/limits';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusyButton } from './busy-button';
import { ErrorBanner } from './error-banner';
import { FieldError } from './field-error';
import { TimeZonePicker } from './time-zone-picker';

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // One expression feeds both the picker and the request, so the zone on screen
  // is always the zone that gets submitted. Splitting the two — a fallback here
  // and another inside the picker — is exactly how this form once displayed the
  // detected zone while posting UTC.
  const detectedTimeZone = useDetectedTimeZone();
  const [chosenTimeZone, setChosenTimeZone] = useState<string | null>(null);
  const timeZone = chosenTimeZone ?? detectedTimeZone;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    setFields({});

    try {
      await signup({ email, password, timeZone });
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
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-invalid={Boolean(fields.password?.length)}
          aria-describedby="password-hint password-error"
        />
        <p id="password-hint" className="text-muted-foreground text-xs">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
        <FieldError fields={fields} name="password" id="password-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="timeZone">Time zone</Label>
        <TimeZonePicker
          id="timeZone"
          value={timeZone}
          onChange={setChosenTimeZone}
          invalid={Boolean(fields.timeZone?.length)}
          describedBy="timeZone-hint timeZone-error"
        />
        <p id="timeZone-hint" className="text-muted-foreground text-xs">
          Your streaks are counted in this zone&rsquo;s days. India appears as
          Asia/Calcutta, which is the same zone as Asia/Kolkata.
        </p>
        <FieldError fields={fields} name="timeZone" id="timeZone-error" />
      </div>

      <ErrorBanner message={error} />

      <BusyButton busy={pending} busyLabel="Creating account…" className="w-full">
        Create account
      </BusyButton>
    </form>
  );
}
