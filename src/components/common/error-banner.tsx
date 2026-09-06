import { AlertCircleIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  message: string;
}

/**
 * A failure the user needs to read.
 *
 * `role="alert"` comes from the Alert primitive, so a screen reader announces
 * it when it appears rather than leaving someone waiting on a button that
 * silently did nothing.
 */
export function ErrorBanner({ message }: Props) {
  if (!message) return null;

  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
