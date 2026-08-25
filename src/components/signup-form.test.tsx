// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const signup = vi.fn();
vi.mock('@/client/auth.api', () => ({ signup: (...args: unknown[]) => signup(...args) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { SignupForm } from './signup-form';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SignupForm', () => {
  it('submits the time zone it is showing', async () => {
    // The form once displayed the detected zone while posting UTC, because the
    // fallback lived in two places. Whatever zone is on screen must be the zone
    // that is sent — this test does not care which one that is.
    signup.mockResolvedValue({ user: {} });
    const user = userEvent.setup();
    render(<SignupForm />);

    const picker = screen.getByRole('combobox', { name: /time zone/i });
    const shownZone = picker.textContent?.trim();

    expect(shownZone).toBeTruthy();

    await user.type(screen.getByLabelText(/email/i), 'mohit@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(signup).toHaveBeenCalledWith({
      email: 'mohit@example.com',
      password: 'correct-horse-battery',
      timeZone: shownZone,
    });
  });

  it('shows the server’s per-field messages under the right inputs', async () => {
    const { ApiClientError } = await import('@/client/api-client');
    signup.mockRejectedValue(
      new ApiClientError(400, 'VALIDATION_ERROR', 'Please correct the errors below.', {
        email: ['Enter a valid email address'],
      })
    );

    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/email/i), 'nope@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Enter a valid email address')).toBeDefined();

    const email = screen.getByLabelText(/email/i);
    // Wired to the input, not just floating on the page...
    expect(email.getAttribute('aria-describedby')).toContain('email-error');
    // ...and the field is announced as invalid, which is what turns on both the
    // screen-reader state and shadcn's red border.
    expect(email.getAttribute('aria-invalid')).toBe('true');
  });
});
