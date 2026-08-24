/**
 * Stand-in for the `server-only` package during tests.
 *
 * The real package throws unless the importer is a React Server Components
 * bundler. Pointing vitest at this file keeps the import guard in the source
 * without breaking the test run, and does not depend on how the package manager
 * happens to lay out node_modules.
 */
export {};
