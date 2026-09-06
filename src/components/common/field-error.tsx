import type { FieldErrors } from '@/lib/api-contract';

interface Props {
  fields: FieldErrors;
  name: string;
  id?: string;
}

/** The server's messages for one input, shown under it. */
export function FieldError({ fields, name, id }: Props) {
  const messages = fields[name];
  if (!messages?.length) return null;

  return (
    <p id={id} className="text-destructive text-sm">
      {messages.join(' ')}
    </p>
  );
}
