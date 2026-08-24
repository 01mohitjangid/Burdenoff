/**
 * Test environment. `src/server/env.ts` validates on import and throws when a
 * variable is missing, so the suite needs values before any server module loads.
 * These are deliberately obvious placeholders: no test touches a real database.
 */
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/habit_tracker_test';
process.env.SESSION_SECRET ??= 'test-session-secret-that-is-long-enough-to-pass';
