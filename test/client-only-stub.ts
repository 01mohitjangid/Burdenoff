/**
 * Stand-in for the `client-only` package during tests.
 *
 * Mirrors `server-only-stub.ts`. The real package is a marker that a bundler
 * resolves; under vitest it only needs to exist and do nothing.
 */
export {};
