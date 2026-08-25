/**
 * Field limits shared by the validators and the forms.
 *
 * They live apart from the zod schemas so a form can show "at least 8
 * characters" without pulling zod into the browser bundle for one number.
 */

export const MIN_PASSWORD_LENGTH = 8;

/**
 * bcrypt reads at most 72 bytes and silently ignores the rest, so two different
 * long passwords sharing a 72-byte prefix would both unlock the account.
 * Rejecting is honest; truncating is a hidden security hole.
 */
export const MAX_PASSWORD_BYTES = 72;

export const MAX_HABIT_NAME_LENGTH = 100;
export const MAX_HABIT_DESCRIPTION_LENGTH = 500;
