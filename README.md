# Habit Tracker with Streaks

Define habits, check in once a day, and see how long your current and longest
streaks are — counted in **your own local days**, never in elapsed hours.

The whole application turns on one rule: two check-ins twenty hours apart may be
the same day or two different days, and only the user's time zone decides which.

---

## Where to look first

If you have twenty minutes, these four files are the assignment:

| File                                                                                           | Why                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`src/lib/local-day.ts`](src/lib/local-day.ts)                                                 | The only file in the codebase that knows time zones exist.   |
| [`src/lib/streaks.ts`](src/lib/streaks.ts)                                                     | Current and longest streak, as pure calendar arithmetic.     |
| [`src/server/services/check-in.service.ts`](src/server/services/check-in.service.ts)           | The four rules a check-in must pass.                         |
| [`src/server/services/check-in.service.test.ts`](src/server/services/check-in.service.test.ts) | The brief's worked example, driven through the real service. |

`npm install`, `cp .env.example .env`, add a PostgreSQL URL, `npm run db:deploy`,
`npm run dev`. Full instructions under [Setup](#setup).

---

## Stack

| Layer    | Choice                                        |
| -------- | --------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4 |
| Backend  | Next.js route handlers                        |
| Database | PostgreSQL via Prisma 6                       |
| Tests    | Vitest                                        |
| Tooling  | TypeScript, ESLint, Prettier                  |

---

## Setup

Requires Node.js 20+ and a PostgreSQL database. A free hosted database
(Neon, Supabase) works without any local install.

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment
cp .env.example .env
#    then put your PostgreSQL connection string in DATABASE_URL

# 3. Create the tables
npm run db:deploy

# 4. Run it
npm run dev            # http://localhost:3000
```

Secrets live in `.env`, which is gitignored. `.env.example` documents every
variable the app needs and is the only env file in version control.

### Scripts

| Script               | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Development server                            |
| `npm run build`      | Production build                              |
| `npm run test`       | Unit tests once                               |
| `npm run test:watch` | Unit tests in watch mode                      |
| `npm run typecheck`  | `tsc --noEmit`                                |
| `npm run lint`       | ESLint                                        |
| `npm run format`     | Prettier, writing changes                     |
| `npm run db:migrate` | Create and apply a migration in development   |
| `npm run db:deploy`  | Apply existing migrations (CI and production) |
| `npm run db:studio`  | Browse the database                           |

---

## Project layout

The tree is split by how much a file is allowed to touch.

```
src/lib/                pure code: no database, no environment, no clock
  local-day.ts          the only file that knows about time zones
  streaks.ts            current/longest streak maths over local days
  session-token.ts      JWT signing and verification, secret injected
  api-contract.ts       the response shapes, shared by server and browser
  limits.ts             field limits, shared by the validators and the forms
  utils.ts              shadcn's className helper
  time-zones.ts         the list the signup picker offers
  validation/           zod schemas for every request body

src/server/             everything that touches infrastructure
  env.ts                the only file that reads process.env, validated with zod
  db.ts                 Prisma client singleton
  password.ts           bcrypt hashing
  session.ts            session cookie, getCurrentUser, requireUser
  prisma-errors.ts      recognising a unique-constraint violation
  api-error.ts          ApiError and the JSON error response
  handler.ts            route() wrapper and JSON body reading
  services/             business logic, the only place that queries Prisma
    auth.service.ts     register and authenticate
    session.service.ts  session rows, so logout can revoke
    user.service.ts     the one definition of a browser-safe user
    habit.service.ts    habit CRUD, ownership, summaries, history
    check-in.service.ts the four rules for recording a day

src/client/             browser-side I/O, the mirror of src/server/
  api-client.ts         one fetch wrapper, typed errors, 204 handling
  habits.api.ts         one function per habit endpoint
  auth.api.ts           signup, login, logout

src/components/         UI pieces
  ui/                   shadcn/ui primitives, vendored by its CLI
  account-bar.tsx       who is signed in, the theme switch, the way out
  habit-card.tsx        one habit on the dashboard
  check-in-button.tsx   the one-click "done today"
  backfill-form.tsx     record a missed day
  check-in-history.tsx  the list of recorded days
  habit-actions.tsx     rename, or delete behind a confirmation dialog
  create-habit-form.tsx add a habit
  signup-form.tsx       owns the resolved time zone
  time-zone-picker.tsx  searchable list of every valid zone
  login-form.tsx        email and password
  sign-out-button.tsx   ends the session server-side
  theme-provider.tsx    light / dark / system, class-driven
  theme-toggle.tsx      the switch itself
  streak-badge.tsx      one number with its label
  busy-button.tsx       disabled and aria-busy while work is in flight
  error-banner.tsx      a failure the user must read
  field-error.tsx       the server's message under its input

src/hooks/              browser-only values the server cannot know
src/app/                routes and pages
prisma/schema.prisma    User, Session, Habit, CheckIn
```

`.claude/` holds local build tooling and is gitignored.

Nothing in `src/lib/` imports from `src/server/`. `local-day.ts` and `streaks.ts`
never reach for Prisma, the environment, or the system clock — `todayIn(zone, now)`
takes the clock as an argument so tests are deterministic. Dependencies point one
way only:

```
route handler   thin: validate, call one service, shape the response
 ↓
service         business rules, the only caller of Prisma
 ↓
database
```

---

## How local days are modelled

This is the part of the design worth reading, so it comes first.

### A local day is a string, not a `Date`

A `Date` is an _instant_. `2026-03-12` is not an instant — it is a square on
somebody's calendar. Storing it as a timestamp means every layer in the stack
(the driver, the ORM, the JSON serialiser, the browser) gets another chance to
re-interpret it in some other zone and quietly shift it by a day.

So a local day is the string `YYYY-MM-DD`, and it never becomes a `Date` again.
Three things fall out of that choice for free:

- ISO date strings sort lexicographically in the same order they sort
  chronologically, so plain string sorting is date sorting.
- Day arithmetic is unaffected by daylight saving. A DST day is 23 or 25 hours
  long, but it is still exactly one day, because a calendar square has no hours.
- The value that leaves the database is the value that was written.

### The conversion happens once, at the edge

`src/lib/local-day.ts` is the only file in the codebase that knows time zones
exist. It converts a UTC instant into a calendar day and then gets out of the
way:

```
UTC instant + IANA zone
  ↓  toLocalDay()          ← the only conversion in the app
"2026-03-12"  (a LocalDay)
  ↓  computeStreaks()      ← pure calendar arithmetic, no zones involved
{ currentStreak, longestStreak }
```

Everything downstream — validation, streak maths, the API, the UI — receives a
`LocalDay` and never touches an offset again. That is what makes the logic
testable without a database, a clock, or a running server.

### What each column is for

A check-in stores **both** facts, because they are genuinely different:

| Column        | Meaning                                                         |
| ------------- | --------------------------------------------------------------- |
| `checkedInAt` | The exact UTC instant the row was written. Audit trail.         |
| `localDay`    | The calendar square it counts for. The streak maths reads this. |

For a check-in made right now the two agree. For a **backfilled** check-in they
do not: `localDay` is a past date while `checkedInAt` is now. Keeping both is
what makes backfilling honest rather than a rewrite of history.

### The four rules a check-in must pass

All four live in [`check-in.service.ts`](src/server/services/check-in.service.ts),
not in a route handler, so they hold no matter who calls.

| Rule                                     | Response                 |
| ---------------------------------------- | ------------------------ |
| The habit must belong to the caller      | `404 NOT_FOUND`          |
| The day cannot be in the caller's future | `400 VALIDATION_ERROR`   |
| The day cannot precede the habit         | `400 VALIDATION_ERROR`   |
| The day cannot already be checked in     | `409 DUPLICATE_CHECK_IN` |

Two of them are time zone questions rather than clock questions:

- **"Future" means future for this user.** At `2026-03-11T21:30Z` it is already
  the 12th in Kolkata and still the 11th in London, so checking in for the 12th
  is valid for one user and premature for the other.
- **"Before the habit existed"** compares calendar days, not instants. The
  habit's creation time is converted into the caller's own calendar first.

A habit belonging to someone else is reported as **missing, not forbidden**. A
403 would confirm that the id exists.

### One check-in per habit per local day

Enforced in two places, on purpose:

- The application rejects a duplicate with a readable error message.
- `@@unique([habitId, localDay])` makes it true under concurrent requests too.

The service inserts and catches the constraint violation rather than reading
first and then inserting. Reading first would still lose the race between the
two, and a double-tapped button is exactly that race.

### Streaks

`currentStreak` counts consecutive days ending **today**, or ending
**yesterday** when today has not been logged yet — a day that is still in
progress should not read as a broken streak. `longestStreak` is the longest run
anywhere in the habit's history. Both are computed on the server from stored
local days, so backfilling a gap recomputes them correctly on the next read and
the frontend never decides whether a streak is alive.

### When a user changes time zone

`User.timeZone` is mutable, but `CheckIn.localDay` is frozen at write time. A
user who moves from Kolkata to Berlin keeps their old check-ins on the days they
actually happened; only new check-ins use the new zone. Recomputing history
would silently move or merge past days, which is worse than the small
inconsistency it would fix.

### The trap this code deliberately avoids

`Intl` accepts bare abbreviations and resolves them to a guess: `IST` becomes
`Asia/Calcutta`, `EST` becomes `America/Panama`. But `IST` also means Irish and
Israel time. Storing one of those guesses would file a user's entire streak
history under the wrong calendar, so only unambiguous IANA IDs
(`Area/Location`, plus `UTC`) are accepted.

---

## The frontend

Reads and writes take deliberately different paths.

```
a page you open                      a button you press
 ↓                                    ↓
server component                     client component
 ↓  calls the service directly        ↓  src/client/*.api.ts
service                              route handler
 ↓                                    ↓  the same four rules
PostgreSQL                           service
                                      ↓
                                     PostgreSQL
```

**Reads go straight through the service.** A server component already _is_
server code, so the dashboard calls `listHabits(user)` rather than making an
HTTP request to its own API. No layer is skipped, and the streaks are correct on
the first paint instead of arriving after a spinner.

**Writes go through the public API.** Checking in, backfilling, creating,
renaming and deleting all use the documented endpoints, so the API is the real
product surface rather than dead code, and the four rules are enforced on
exactly the path a reviewer can `curl`.

After a write the client calls `router.refresh()` instead of patching state by
hand. The server already returned recomputed streaks, so re-rendering from it is
both simpler and impossible to get out of step.

### What the browser is never trusted with

- **Today.** The one-click button sends no date at all. Changing your laptop's
  clock or time zone does nothing.
- **Whether a streak is alive.** `currentStreak` and `longestStreak` arrive as
  integers the server computed.
- **The backfill bounds.** The date input's `min` and `max` come from the
  server's `startedOn` and `today`. They only stop the impossible choices being
  pickable; the same rules are enforced again on the way in.

### Errors

The API's `fields` map is rendered under the input it belongs to, and its `code`
lets the UI treat a specific case differently — a duplicate check-in reads as
"already done today", not as a generic failure. Anything unexpected becomes one
neutral sentence, so a database message can never reach a user.

---

## The interface

Built on [shadcn/ui](https://ui.shadcn.com): Radix primitives, vendored into
`src/components/ui/` rather than installed, so they can be read and changed like
any other file in the repo.

- **Light, dark and system themes**, chosen by the user rather than inherited
  from the operating system. shadcn drives dark mode from a class on `<html>`,
  so `next-themes` is what makes it work at all.
- **One indigo accent and one green success colour.** shadcn's default primary
  is near-black and it ships no success colour; a streak is the one piece of
  good news this app has to give, so it gets one.
- **A searchable time zone picker.** There are over four hundred zones. Typing
  "kol" beats scrolling to `Asia/Calcutta`.
- **A confirmation dialog before deleting**, which traps focus, closes on
  Escape, and returns focus to the trigger.

Two things the interface is careful about, both learned the hard way:

- **What is displayed is what is submitted.** The signup form resolves the time
  zone once and hands the same value to the picker and to the request. When
  those were two separate expressions, the form showed the detected zone and
  posted `UTC`.
- **Nothing browser-specific is read during render.** A client component is
  still rendered once on the server, where `Intl` reports the _host's_ time zone
  and `localStorage` does not exist. Both go through `useSyncExternalStore` with
  a separate server snapshot, so the first render matches on both sides.

---

## Tests

```bash
npm run test
```

Local days and streaks: the worked example from the brief end to end,
same-local-day duplicates, both sides of a daylight-saving change, zones from
UTC+14 to UTC-11, half-hour offsets at the midnight boundary, month, year and
leap-day boundaries, and the ambiguous-abbreviation trap described above.

Check-ins: each of the four rules, that "future" and "before the habit existed"
are decided per user rather than per server clock, that a backfill closing a gap
re-computes the streak, that a habit is only ever queried scoped to its owner,
and the brief's worked example driven through the real service with an in-memory
table that enforces the unique constraint.

Auth: that an unknown email and a wrong password produce a byte-identical error,
that the login timing decoy is a real cost-12 hash and actually spends the time,
that a duplicate email surfaces as a readable 409 while an unrelated database
failure does not, that a password hash can never be returned to a caller, that a
token signed for a different purpose is rejected, and that the JSON body reader
cannot be fooled by a content type with `application/json` hidden in a parameter.

The browser layer: that the API client always declares JSON, serialises its
body, does not try to read a 204, carries the server's own wording through to
the user, and that an empty backfill date is refused rather than quietly
recorded as today. The signup form has its own test asserting that the time zone
it displays is the time zone it submits — the two were once resolved in separate
places, and the form showed one zone while posting another.

The whole suite runs without a database, a network, or a real clock.

---

## API

All responses are JSON. Errors share one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "fields": { "email": ["..."] }
  }
}
```

| Method   | Path                        | Purpose                                    |
| -------- | --------------------------- | ------------------------------------------ |
| `POST`   | `/api/auth/signup`          | Create an account and start a session      |
| `POST`   | `/api/auth/login`           | Start a session                            |
| `POST`   | `/api/auth/logout`          | End the session                            |
| `GET`    | `/api/auth/me`              | The current user, plus the server's today  |
| `GET`    | `/api/habits`               | The caller's habits, each with its streaks |
| `POST`   | `/api/habits`               | Create a habit                             |
| `GET`    | `/api/habits/:id`           | One habit plus its full check-in history   |
| `PATCH`  | `/api/habits/:id`           | Rename a habit or change its description   |
| `DELETE` | `/api/habits/:id`           | Delete a habit and its check-ins           |
| `POST`   | `/api/habits/:id/check-ins` | Check in for today, or backfill a past day |

Every habit response carries `currentStreak` and `longestStreak` as integers the
server computed. The frontend never decides whether a streak is alive.

`POST /api/habits/:id/check-ins` takes an optional `localDay`. Omitting it means
today, which is what the one-click button sends. Supplying a past date is a
backfill. The response includes the habit with its streaks already recomputed,
so the caller does not need a second request.

Requests must set `Content-Type: application/json`.

`GET /api/auth/me` returns `today` alongside the user because the server owns
what today is. The browser's clock and time zone are never trusted.

---

## Security decisions

Written down because each one is a trade-off, not an accident.

- **Passwords** are hashed with bcrypt at cost 12, and capped at 72 bytes
  because bcrypt silently ignores anything beyond that.
- **Login never reveals whether an email exists.** Unknown email and wrong
  password return the identical error, and an unknown email still spends the
  same bcrypt time against a decoy hash so the response timing matches.
- **Signup does reveal it**, by returning `409 EMAIL_TAKEN`. That is a
  deliberate trade: telling someone their email is already registered is worth
  more than the enumeration it allows, and the same information is available
  from any password-reset flow.
- **The session cookie** is `httpOnly`, `sameSite=lax`, `path=/`, and `secure`
  everywhere except an explicitly-set development environment, so an unset
  `NODE_ENV` fails closed rather than open.
- **The session token names a session row, not a user.** The cookie holds an
  HS256 token with an audience claim whose subject is a `Session` id. The
  signature proves the cookie was not forged; the row proves the session is
  still meant to be alive. Both are required on every request.
- **Logging out really revokes.** `endSession` deletes the row before clearing
  the cookie, so a copy of the same cookie taken earlier stops working on its
  next request rather than lasting until the token expires. The row is deleted
  first on purpose: if the delete fails, the request errors and the user stays
  logged in, which is honest. Clearing the cookie first would report success
  while the session was still live.
- **The user's time zone is never in the token.** It is read through the session
  row on each request, so changing it applies immediately.
- **Request bodies are capped at 16KB**, read a chunk at a time so the limit
  holds even when the client sends no `content-length`.
- **Thin, deliberately:** component tests cover the one thing components can get
  wrong on their own — showing the user one value and sending another. Every
  rule they touch is enforced and tested again on the server.
- **Not built:** pagination on the check-in history. A habit can hold at most one
  check-in per day, so a year of perfect adherence is 365 rows. A limit is worth
  adding the day that stops being true.
- **Not built:** a read timeout. A client that declares a JSON body and then
  dribbles one byte per second holds a handler open, and a size cap cannot help
  because the body never gets large. Request timeouts belong to the platform
  (Vercel, nginx), not to application code.
- **Not built:** rate limiting on login. bcrypt at cost 12 costs about 220ms of
  CPU, so an unthrottled login endpoint is a denial-of-service surface. In
  production this belongs at the edge or in a shared store, not in app memory.

---

## Build status

| Step | Scope                                                         | Status |
| ---- | ------------------------------------------------------------- | ------ |
| 1    | Foundation: schema, migration, local-day and streak libraries | Done   |
| 2    | Auth: signup with time zone, login, sessions                  | Done   |
| 3    | API: habit CRUD, check-ins, validation, streak endpoints      | Done   |
| 4    | Frontend: dashboard, check-in, history, backfill              | Done   |
